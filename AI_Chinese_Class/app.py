import streamlit as st
import azure.cognitiveservices.speech as speechsdk
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
import google.generativeai as genai
from audio_recorder_streamlit import audio_recorder # 新增：网页录音器
import os

# ================= 配置区域 =================
SPEECH_KEY = "9nbzKMOw75J5JkWZq0VPTHGvsE00tIR26glNYRMg4cvESlXbpphPJQQJ99BKACqBBLyXJ3w3AAAYACOGoObJ"
SPEECH_REGION = "southeastasia"
LANGUAGE = "zh-CN"
GEMINI_API_KEY = "AIzaSyCbNXFn3phqWmxGgFtQZPOn5y8rMUgAjHI"

# 配置 Gemini
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-pro')

# ================= 核心功能 =================

# 1. 连接数据库 (适配云端路径)
if not firebase_admin._apps:
    try:
        # 在云端，我们依然读取这个文件，稍后教你怎么上传
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred)
    except Exception as e:
        # 如果还没上传key，先不报错，等待用户上传
        pass

# 获取数据库引用（如果连接失败则为 None）
try:
    db = firestore.client()
except:
    db = None

# 2. Azure 语音分析 (改为处理文件)
def analyze_audio_file(audio_path, reference_text):
    speech_config = speechsdk.SpeechConfig(subscription=SPEECH_KEY, region=SPEECH_REGION)
    speech_config.speech_recognition_language = LANGUAGE
    
    pronunciation_config = speechsdk.PronunciationAssessmentConfig(
        reference_text=reference_text,
        grading_system=speechsdk.PronunciationAssessmentGradingSystem.HundredMark,
        granularity=speechsdk.PronunciationAssessmentGranularity.Phoneme,
        enable_miscue=True
    )
    
    # 【关键修改】这里不再使用麦克风，而是读取文件
    audio_config = speechsdk.audio.AudioConfig(filename=audio_path)
    recognizer = speechsdk.SpeechRecognizer(speech_config=speech_config, audio_config=audio_config)
    pronunciation_config.apply_to(recognizer)

    result = recognizer.recognize_once()
    return result

# 3. Gemini 评语
def get_ai_feedback(text, score):
    prompt = f"你是一位小学语文老师。学生读了：'{text}'。得分：{score}。请给一句50字以内的暖心评语（带emoji）。"
    try:
        response = model.generate_content(prompt)
        return response.text
    except:
        return "老师正在思考中...👍"

# 4. 保存到数据库
def save_to_firebase(student_name, text, score, comment):
    if db is None:
        st.error("⚠️ 数据库未连接，成绩无法保存。")
        return
    db.collection("class_scores").add({
        "name": student_name,
        "text": text,
        "score": score,
        "ai_comment": comment,
        "timestamp": datetime.now()
    })

# ================= 网页界面 =================
st.set_page_config(page_title="AI 朗读云端版", page_icon="☁️")

st.title("☁️ AI 朗读评分系统 (网页版)")

with st.sidebar:
    st.header("📝 学生信息")
    student_name = st.text_input("请输入你的名字：", "")
    
    # 检查数据库状态
    if db is None:
        st.error("数据库未连接 (Key缺失)")
    else:
        st.success("云端数据库已连接")

st.markdown("### 📖 第一步：练习课文")
reference_text = st.text_area("老师要把哪段课文放这里？", "白日依山尽，黄河入海流。欲穷千里目，更上一层楼。")

st.markdown("### 🎙️ 第二步：点击录音")
st.info("👇 点击下面的麦克风图标开始，读完再点一次停止。")

# 【核心修改】使用网页录音组件
audio_bytes = audio_recorder(text="", recording_color="#e8b62c", neutral_color="#6aa36f", icon_size="3x")

if audio_bytes:
    # 只有当录到了声音，才显示“提交”按钮
    st.audio(audio_bytes, format="audio/wav") # 让学生回听
    
    if st.button("📤 提交评分"):
        if not student_name:
            st.warning("👉 请先在左侧输入名字！")
        else:
            with st.spinner("☁️ 正在上传云端并打分..."):
                # 1. 把录音存成临时文件
                temp_filename = "temp_audio.wav"
                with open(temp_filename, "wb") as f:
                    f.write(audio_bytes)
                
                # 2. 调用 Azure 分析文件
                result = analyze_audio_file(temp_filename, reference_text)
                
                if result.reason == speechsdk.ResultReason.RecognizedSpeech:
                    pronunciation_result = speechsdk.PronunciationAssessmentResult(result)
                    score = pronunciation_result.accuracy_score
                    
                    col1, col2 = st.columns(2)
                    with col1:
                        st.metric("你的得分", f"{score:.0f}")
                    
                    with st.spinner("🤖 AI 老师正在写评语..."):
                        ai_comment = get_ai_feedback(reference_text, score)
                        
                    with col2:
                        st.info(f"👩‍🏫 **AI 老师说：**\n\n{ai_comment}")
                    
                    if score > 90: st.balloons()
                    
                    save_to_firebase(student_name, reference_text, score, ai_comment)
                    st.success("✅ 成绩已永久保存！")
                    
                    # 清理临时文件
                    os.remove(temp_filename)
                    
                elif result.reason == speechsdk.ResultReason.NoMatch:
                    st.error("❌ 没听清，请录制得清晰一点。")
                else:
                    st.error("❌ 发生错误，请重试。")

# --- 历史记录 ---
st.markdown("---")
st.subheader("🏆 班级光荣榜")
if db:
    try:
        docs = db.collection("class_scores").order_by("timestamp", direction=firestore.Query.DESCENDING).limit(5).stream()
        data = [{"学生": d.to_dict().get('name'), "分数": f"{d.to_dict().get('score'):.0f}", "评语": d.to_dict().get('ai_comment'), "时间": d.to_dict().get('timestamp').strftime("%H:%M")} for d in docs]
        if data: st.dataframe(data, hide_index=True)
    except:
        st.write("等待数据...")