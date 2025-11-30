import streamlit as st
import azure.cognitiveservices.speech as speechsdk
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
import google.generativeai as genai
from audio_recorder_streamlit import audio_recorder
import os
import json

# ================= 网页设置 =================
st.set_page_config(page_title="AI 朗读小助手", page_icon="🦜")

# ================= 🔐 安全读取密钥 (云端版) =================
# 这段代码会自动去 Streamlit 的保险箱里找钥匙
try:
    SPEECH_KEY = st.secrets["SPEECH_KEY"]
    SPEECH_REGION = st.secrets["SPEECH_REGION"]
    GEMINI_API_KEY = st.secrets["GEMINI_API_KEY"]
    # Firebase 比较特殊，我们把整个 JSON 内容存在保险箱里
    firebase_key_dict = json.loads(st.secrets["FIREBASE_KEY"])
except FileNotFoundError:
    st.error("❌ 尚未配置云端密钥！请在 Streamlit 后台的 Secrets 里填入密钥。")
    st.stop()

# ================= 初始化服务 =================

# 1. 配置 Gemini
genai.configure(api_key=GEMINI_API_KEY)
# 智能选择模型
valid_model = None
try:
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods and 'gemini' in m.name:
            valid_model = genai.GenerativeModel(m.name)
            break
except: pass
if valid_model is None: valid_model = genai.GenerativeModel('gemini-pro')

# 2. 连接 Firebase 数据库
if not firebase_admin._apps:
    try:
        cred = credentials.Certificate(firebase_key_dict)
        firebase_admin.initialize_app(cred)
    except Exception as e:
        st.error(f"数据库连接失败: {e}")

try:
    db = firestore.client()
except:
    db = None

# ================= 功能函数 =================

def analyze_audio_file(audio_filepath, reference_text):
    speech_config = speechsdk.SpeechConfig(subscription=SPEECH_KEY, region=SPEECH_REGION)
    speech_config.speech_recognition_language = "zh-CN"
    
    pronunciation_config = speechsdk.PronunciationAssessmentConfig(
        reference_text=reference_text,
        grading_system=speechsdk.PronunciationAssessmentGradingSystem.HundredMark,
        granularity=speechsdk.PronunciationAssessmentGranularity.Phoneme,
        enable_miscue=True
    )
    
    audio_config = speechsdk.audio.AudioConfig(filename=audio_filepath)
    recognizer = speechsdk.SpeechRecognizer(speech_config=speech_config, audio_config=audio_config)
    pronunciation_config.apply_to(recognizer)

    result = recognizer.recognize_once()
    return result

def get_ai_feedback(text, score):
    prompt = f"你是一位亲切的小学语文老师。学生朗读：'{text}'。得分：{score}。请给一句50字以内的暖心评语（带emoji）。"
    try:
        response = valid_model.generate_content(prompt)
        return response.text
    except: return "老师正在思考中...👍"

def save_to_firebase(student_name, text, score, comment):
    if db:
        db.collection("class_scores").add({
            "name": student_name, "text": text, "score": score, "ai_comment": comment, "timestamp": datetime.now()
        })

# ================= 网页界面 =================

st.title("🦜 AI 朗读评分系统")

with st.sidebar:
    st.header("📝 学生信息")
    student_name = st.text_input("请输入你的名字：", "")
    if st.button("刷新排行榜"): st.rerun()
    if db: st.success("☁️ 云端连接正常")

st.markdown("### 📖 第一步：练习课文")
reference_text = st.text_area("老师要把哪段课文放这里？", "白日依山尽，黄河入海流。欲穷千里目，更上一层楼。")

st.markdown("### 🎙️ 第二步：点击录音")
audio_bytes = audio_recorder(text="", recording_color="#e8b62c", neutral_color="#6aa36f", icon_size="3x")

if audio_bytes:
    st.audio(audio_bytes, format="audio/wav")
    
    if st.button("📤 提交给老师评分"):
        if not student_name:
            st.warning("👉 请先在左侧输入名字！")
        else:
            with st.spinner("☁️ 正在上传并评分..."):
                temp_filename = "temp_audio.wav"
                with open(temp_filename, "wb") as f:
                    f.write(audio_bytes)
                
                try:
                    result = analyze_audio_file(temp_filename, reference_text)
                    if result.reason == speechsdk.ResultReason.RecognizedSpeech:
                        score = speechsdk.PronunciationAssessmentResult(result).accuracy_score
                        
                        col1, col2 = st.columns(2)
                        with col1: st.metric("你的得分", f"{score:.0f}")
                        
                        ai_comment = get_ai_feedback(reference_text, score)
                        with col2: st.info(f"👩‍🏫 **AI 老师说：**\n\n{ai_comment}")
                        
                        if score > 90: st.balloons()
                        save_to_firebase(student_name, reference_text, score, ai_comment)
                        st.success("✅ 成绩已保存！")
                    else:
                        st.error("❌ 没听清，请大声一点！")
                except Exception as e:
                    st.error(f"系统错误: {e}")
                
                if os.path.exists(temp_filename): os.remove(temp_filename)

st.markdown("---")
st.subheader("🏆 班级光荣榜")
if db:
    try:
        docs = db.collection("class_scores").order_by("timestamp", direction=firestore.Query.DESCENDING).limit(5).stream()
        data = [{"学生": d.to_dict().get('name'), "分数": f"{d.to_dict().get('score'):.0f}", "评语": d.to_dict().get('ai_comment'), "时间": d.to_dict().get('timestamp').strftime("%H:%M")} for d in docs]
        if data: st.dataframe(data, hide_index=True)
    except: st.write("等待数据中...")