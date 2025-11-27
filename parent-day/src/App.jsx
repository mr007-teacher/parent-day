import React, { useState, useEffect, useMemo } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signInWithCustomToken,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  Timestamp,
  deleteDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import {
  Users,
  Clock,
  ChevronRight,
  SkipForward,
  RefreshCcw,
  Monitor,
  CheckCircle,
  AlertCircle,
  Lock,
  LogOut,
  BellRing,
  Pause,
  Play,
  History,
  User,
  X,
  Search,
  Download,
  ArrowUpCircle,
  Settings,
  FileText,
  Calendar,
  MessageSquare,
  Trash2,
  AlertTriangle,
  Info,
} from "lucide-react";

// --- Configuration ---
const STUDENT_LIST = [
  "许展旺",
  "颜楷易",
  "陈文徳",
  "谢家宏",
  "张泰元",
  "陈楷瑞",
  "黎愷玹",
  "李宇智",
  "李恩杰",
  "李自捷",
  "谢承峰",
  "何嘉颖",
  "胡世宸",
  "张立唯",
  "陈若恒",
  "黄靖宇",
  "叶运淮",
  "叶湧权",
  "江本昕",
  "陈思语",
  "杨雨晴",
  "邱意棠",
  "庞祖儿",
  "李妍希",
  "林语晴",
  "张语乔",
  "张敏瑄",
  "黄芷潼",
  "黄煊涵",
  "孙慧柔",
  "陈恩茜",
  "陈颐睿",
  "王梓倩",
  "袁泺芹",
  "岑彩宜",
  "陈苇恩",
  "赵子婷",
  "尤巧恩",
];

const firebaseConfig = {
  apiKey: "AIzaSyCsoWoeAIHY5zKmC2xtKagZg1yY0r7KXQ0",
  authDomain: "n-parent-s-day.firebaseapp.com",
  projectId: "n-parent-s-day",
  storageBucket: "n-parent-s-day.firebasestorage.app",
  messagingSenderId: "915432670478",
  appId: "1:915432670478:web:f0ea8f33f867e7bd06035f",
  measurementId: "G-43WPJMXELF",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "n-parent-s-day"; 

// --- Main Application ---
export default function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [queueData, setQueueData] = useState([]);
  const [settings, setSettings] = useState({
    isBookingEnabled: false,
    bookingStartTime: null,
    interviewStartTime: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (
          typeof __initial_auth_token !== "undefined" &&
          __initial_auth_token
        ) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Fetch Queue Data
  useEffect(() => {
    if (!user) return;
    const q = collection(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      "parent_day_queue"
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = [];
      snapshot.forEach((doc) =>
        items.push({ id: doc.id, ...doc.data() })
      );

      // Sort by orderTime (priority) -> then joinedAt (fallback) -> then number
      items.sort((a, b) => {
        const timeA = a.orderTime?.toMillis() || a.joinedAt?.toMillis() || 0;
        const timeB = b.orderTime?.toMillis() || b.joinedAt?.toMillis() || 0;
        return timeA - timeB;
      });

      setQueueData(items);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // Fetch Settings
  useEffect(() => {
    if (!user) return;
    const docRef = doc(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      "parent_day_settings",
      "config"
    );
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data());
      } else {
        // Default settings if not found
        setSettings({
          isBookingEnabled: true,
          bookingStartTime: null,
          interviewStartTime: null,
        });
      }
    });
    return () => unsubscribe();
  }, [user]);

  const stats = useMemo(() => {
    const completed = queueData.filter(
      (i) => i.status === "completed" && i.durationSeconds !== undefined
    );
    const totalDuration = completed.reduce(
      (acc, curr) => acc + (curr.durationSeconds || 0),
      0
    );
    const avgDuration =
      completed.length > 0 ? totalDuration / completed.length : 600;
    return {
      completedCount: completed.length,
      avgDurationSeconds: avgDuration,
      waitingCount: queueData.filter((i) => i.status === "waiting").length,
    };
  }, [queueData]);

  const currentSession = queueData.find((i) => i.status === "current");
  const waitingList = queueData.filter((i) => i.status === "waiting");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (isAdmin) {
    return (
      <TeacherDashboard
        queue={queueData}
        stats={stats}
        current={currentSession}
        waiting={waitingList}
        settings={settings}
        onLogout={() => setIsAdmin(false)}
      />
    );
  }

  return (
    <ParentInterface
      queue={queueData}
      stats={stats}
      current={currentSession}
      settings={settings}
      onAdminLogin={() => setIsAdmin(true)}
    />
  );
}

// --- Teacher Dashboard ---
function TeacherDashboard({
  queue,
  stats,
  current,
  waiting,
  settings,
  onLogout,
}) {
  const [elapsed, setElapsed] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [registrations, setRegistrations] = useState([]);

  // Local state for settings form
  const [formBookingEnabled, setFormBookingEnabled] = useState(
    settings.isBookingEnabled
  );
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [interviewDate, setInterviewDate] = useState("");
  const [interviewTime, setInterviewTime] = useState("");

  // Initialize settings form
  useEffect(() => {
    setFormBookingEnabled(settings.isBookingEnabled);

    if (settings.bookingStartTime) {
      const date = settings.bookingStartTime.toDate();
      setBookingDate(date.toISOString().split("T")[0]);
      setBookingTime(date.toTimeString().slice(0, 5));
    }
    if (settings.interviewStartTime) {
      const date = settings.interviewStartTime.toDate();
      setInterviewDate(date.toISOString().split("T")[0]);
      setInterviewTime(date.toTimeString().slice(0, 5));
    }
  }, [settings]);

  // Timer Logic
  useEffect(() => {
    let interval;
    const calculateTime = () => {
      if (!current || !current.startedAt) return 0;
      const now = Date.now();
      const start = current.startedAt.toMillis();
      const accumulatedPause = (current.accumulatedPauseSeconds || 0) * 1000;

      if (current.isPaused && current.pauseStartTime) {
        const pauseStart = current.pauseStartTime.toMillis();
        return Math.floor((pauseStart - start - accumulatedPause) / 1000);
      } else {
        return Math.floor((now - start - accumulatedPause) / 1000);
      }
    };

    if (current) {
      setElapsed(calculateTime());
      if (!current.isPaused) {
        interval = setInterval(() => setElapsed(calculateTime()), 1000);
      }
    } else {
      setElapsed(0);
    }
    return () => clearInterval(interval);
  }, [current]);

  const handleSaveSettings = async () => {
    let bookingTimestamp = null;
    if (bookingDate && bookingTime) {
      bookingTimestamp = Timestamp.fromDate(
        new Date(`${bookingDate}T${bookingTime}`)
      );
    }

    let interviewTimestamp = null;
    if (interviewDate && interviewTime) {
      interviewTimestamp = Timestamp.fromDate(
        new Date(`${interviewDate}T${interviewTime}`)
      );
    }

    await setDoc(
      doc(
        db,
        "artifacts",
        appId,
        "public",
        "data",
        "parent_day_settings",
        "config"
      ),
      {
        isBookingEnabled: formBookingEnabled,
        bookingStartTime: bookingTimestamp,
        interviewStartTime: interviewTimestamp,
      }
    );
    alert("设置已保存！");
  };

  const handlePauseToggle = async () => {
    if (!current) return;
    if (current.isPaused) {
      const pauseStart = current.pauseStartTime?.toMillis() || Date.now();
      const pauseDurationSeconds = (Date.now() - pauseStart) / 1000;
      const newAccumulated =
        (current.accumulatedPauseSeconds || 0) + pauseDurationSeconds;
      await updateDoc(
        doc(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "parent_day_queue",
          current.id
        ),
        {
          isPaused: false,
          pauseStartTime: null,
          accumulatedPauseSeconds: newAccumulated,
        }
      );
    } else {
      await updateDoc(
        doc(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "parent_day_queue",
          current.id
        ),
        {
          isPaused: true,
          pauseStartTime: serverTimestamp(),
        }
      );
    }
  };

  const handleNext = async () => {
    if (current) {
      const now = Date.now();
      const start = current.startedAt.toMillis();
      const accumulatedPause = (current.accumulatedPauseSeconds || 0) * 1000;
      let finalDuration = 0;

      if (current.isPaused && current.pauseStartTime) {
        const pauseStart = current.pauseStartTime.toMillis();
        finalDuration = Math.floor(
          (pauseStart - start - accumulatedPause) / 1000
        );
      } else {
        finalDuration = Math.floor((now - start - accumulatedPause) / 1000);
      }

      await updateDoc(
        doc(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "parent_day_queue",
          current.id
        ),
        {
          status: "completed",
          completedAt: serverTimestamp(),
          durationSeconds: finalDuration,
          isPaused: false,
        }
      );
    }

    if (waiting.length > 0) {
      const nextPerson = waiting[0];
      await updateDoc(
        doc(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "parent_day_queue",
          nextPerson.id
        ),
        {
          status: "current",
          startedAt: serverTimestamp(),
          accumulatedPauseSeconds: 0,
          isPaused: false,
        }
      );
    }
  };

  const handleRequeue = async () => {
    if (!current) return;
    await updateDoc(
      doc(
        db,
        "artifacts",
        appId,
        "public",
        "data",
        "parent_day_queue",
        current.id
      ),
      {
        status: "waiting",
        isPaused: false,
        startedAt: null,
        accumulatedPauseSeconds: 0,
        orderTime: serverTimestamp(),
      }
    );

    if (waiting.length > 0) {
      const nextPerson = waiting[0];
      await updateDoc(
        doc(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "parent_day_queue",
          nextPerson.id
        ),
        {
          status: "current",
          startedAt: serverTimestamp(),
          accumulatedPauseSeconds: 0,
          isPaused: false,
        }
      );
    }
  };

  const handleJumpQueue = async (ticket) => {
    if (waiting.length === 0) return;
    const topTicket = waiting[0];
    const topTime =
      topTicket.orderTime?.toMillis() || topTicket.joinedAt.toMillis();
    const newOrderTime = Timestamp.fromMillis(topTime - 1000);
    await updateDoc(
      doc(
        db,
        "artifacts",
        appId,
        "public",
        "data",
        "parent_day_queue",
        ticket.id
      ),
      {
        orderTime: newOrderTime,
      }
    );
  };

  // NEW: Handle Reset with custom UI logic
  const executeReset = async () => {
    setIsResetting(true);
    try {
      // 1. Delete All Queue Data
      const queueSnapshot = await getDocs(
        collection(db, "artifacts", appId, "public", "data", "parent_day_queue")
      );
      const queueDeletes = queueSnapshot.docs.map((d) => deleteDoc(d.ref));

      // 2. Delete All Registration Data
      const regSnapshot = await getDocs(
        collection(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "parent_day_registrations"
        )
      );
      const regDeletes = regSnapshot.docs.map((d) => deleteDoc(d.ref));

      // Execute all deletions
      await Promise.all([...queueDeletes, ...regDeletes]);

      // Clear local state
      setRegistrations([]);
      setShowResetConfirm(false); // Close modal
    } catch (err) {
      console.error(err);
      alert("重置过程中发生错误，请检查网络。");
    } finally {
      setIsResetting(false);
    }
  };

  const fetchRegistrations = async () => {
    const q = query(
      collection(
        db,
        "artifacts",
        appId,
        "public",
        "data",
        "parent_day_registrations"
      ),
      orderBy("submittedAt", "desc")
    );
    const snapshot = await getDocs(q);
    const items = [];
    snapshot.forEach((doc) =>
      items.push({ id: doc.id, ...doc.data() })
    );
    setRegistrations(items);
  };

  useEffect(() => {
    if (showHistory) {
      fetchRegistrations();
    }
  }, [showHistory]);

  const formatTimer = (secs) => {
    if (secs < 0) return "00:00";
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const completedList = queue
    .filter((i) => i.status === "completed")
    .sort(
      (a, b) =>
        (b.completedAt?.seconds || 0) - (a.completedAt?.seconds || 0)
    );

  const handleExportCSV = () => {
    if (completedList.length === 0) {
      alert("暂无面谈记录可汇出");
      return;
    }
    const headers = ["号码,学生姓名,家长姓名,开始时间,结束时间,时长"];
    const rows = completedList.map((item) => {
      const start = item.startedAt
        ? item.startedAt.toDate().toLocaleString("zh-CN")
        : "-";
      const end = item.completedAt
        ? item.completedAt.toDate().toLocaleString("zh-CN")
        : "-";
      const duration = formatTimer(item.durationSeconds || 0);
      return `${item.number},${item.studentName},${item.parentName},${start},${end},${duration}`;
    });
    const csvContent = "\uFEFF" + [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `3N班家长日_面谈记录_${new Date().toLocaleDateString()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportRegistrations = () => {
    if (registrations.length === 0) {
      alert("暂无资料提交记录可汇出");
      return;
    }
    const headers = ["提交时间,家长姓名,学生姓名,建议,问题"];
    const rows = registrations.map((item) => {
      const time = item.submittedAt?.toDate().toLocaleString("zh-CN") || "-";
      // Replace commas and newlines to keep CSV clean
      const cleanSuggestion = (item.suggestions || "")
        .replace(/,/g, "，")
        .replace(/\n/g, " ");
      const cleanQuestion = (item.questions || "")
        .replace(/,/g, "，")
        .replace(/\n/g, " ");
      return `${time},${item.parentName},${item.studentName},${cleanSuggestion},${cleanQuestion}`;
    });
    const csvContent = "\uFEFF" + [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `3N班家长日_家长资料_${new Date().toLocaleDateString()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-40 font-sans relative">
      <header className="bg-white shadow px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Monitor className="w-6 h-6 text-indigo-600" />
          教师控制台
        </h2>
        <div className="flex gap-4">
          <button
            onClick={() => setShowHistory(true)}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            <History className="w-4 h-4" /> 历史记录/资料
          </button>
          <button
            onClick={onLogout}
            className="text-sm text-gray-500 hover:text-red-600 flex items-center gap-1"
          >
            <LogOut className="w-4 h-4" /> 退出
          </button>
        </div>
      </header>

      <main className="p-4 lg:p-6 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Current Card */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
            <div
              className={`p-4 text-white flex justify-between items-center transition-colors duration-300 ${
                current?.isPaused ? "bg-orange-500" : "bg-indigo-600"
              }`}
            >
              <span className="font-semibold text-indigo-50 flex items-center gap-2">
                {current?.isPaused ? (
                  <>
                    <Pause className="w-5 h-5" /> 暂停中
                  </>
                ) : (
                  "当前正在面谈"
                )}
              </span>
              <div
                className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-mono ${
                  current?.isPaused ? "bg-orange-700" : "bg-indigo-800"
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>{formatTimer(elapsed)}</span>
              </div>
            </div>

            <div className="p-8 text-center">
              {current ? (
                <>
                  <div
                    className={`text-8xl font-black tracking-tighter mb-2 transition-opacity ${
                      current.isPaused ? "opacity-50" : "text-gray-800"
                    }`}
                  >
                    {current.number}
                  </div>
                  <div className="text-2xl text-indigo-600 font-bold mb-8">
                    {current.studentName}
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <button
                      onClick={handlePauseToggle}
                      className={`flex flex-col items-center justify-center gap-1 py-4 px-4 rounded-xl transition font-bold border ${
                        current.isPaused
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "bg-orange-50 text-orange-600 border-orange-200"
                      }`}
                    >
                      {current.isPaused ? (
                        <Play className="w-6 h-6" />
                      ) : (
                        <Pause className="w-6 h-6" />
                      )}
                      <span className="text-xs">
                        {current.isPaused ? "恢复计时" : "暂停计时"}
                      </span>
                    </button>

                    <button
                      onClick={handleRequeue}
                      className="flex flex-col items-center justify-center gap-1 py-4 px-4 bg-yellow-50 text-yellow-700 rounded-xl hover:bg-yellow-100 transition font-bold border border-yellow-200"
                    >
                      <RefreshCcw className="w-6 h-6" />
                      <span className="text-xs">不在场 (重新排队)</span>
                    </button>

                    <button
                      onClick={handleNext}
                      className="flex flex-col items-center justify-center gap-1 py-4 px-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition shadow-lg font-bold"
                    >
                      <ChevronRight className="w-8 h-8" />
                      <span className="text-xs">完成/下一位</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-12 text-gray-400">
                  <div className="text-xl mb-4">当前空闲</div>
                  {waiting.length > 0 ? (
                    <button
                      onClick={handleNext}
                      className="px-8 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 shadow-lg font-bold animate-bounce"
                    >
                      开始叫号 ({waiting[0].number})
                    </button>
                  ) : (
                    <div className="text-sm">等待家长扫码加入...</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl shadow-sm text-center border border-gray-100">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                平均耗时
              </div>
              <div className="text-xl font-bold text-gray-800">
                {Math.round(stats.avgDurationSeconds / 60)} 分钟
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm text-center border border-gray-100">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                已完成
              </div>
              <div className="text-xl font-bold text-green-600">
                {stats.completedCount} 人
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm text-center border border-gray-100">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                等待中
              </div>
              <div className="text-xl font-bold text-orange-500">
                {stats.waitingCount} 人
              </div>
            </div>
          </div>

          {/* Settings Panel was here, now moved to the right column */}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm h-full max-h-[600px] flex flex-col border border-gray-100">
            <div className="p-4 border-b border-gray-100 font-bold text-gray-700 flex justify-between items-center bg-gray-50 rounded-t-2xl">
              <span>等待队列</span>
              <span className="text-xs bg-white border border-gray-200 px-2 py-1 rounded-full text-gray-500">
                Next 5
              </span>
            </div>
            <div className="overflow-y-auto flex-1 p-2 space-y-2">
              {waiting.length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  队列为空
                </div>
              )}
              {waiting.map((item, index) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl flex justify-between items-center group transition-colors ${
                    index === 0
                      ? "bg-green-50 border border-green-200 shadow-sm"
                      : "bg-white border border-gray-100 hover:bg-gray-50"
                  }`}
                >
                  <div>
                    <div className="font-bold text-gray-800 text-lg flex items-center gap-2">
                      {item.number}
                      {index === 0 && (
                        <span className="text-[10px] bg-green-600 text-white px-1.5 py-0.5 rounded">
                          NEXT
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-gray-700">
                      {item.studentName}
                    </div>
                  </div>

                  {index > 0 && (
                    <button
                      onClick={() => handleJumpQueue(item)}
                      className="p-2 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                      title="插队：移至第一位"
                    >
                      <ArrowUpCircle className="w-6 h-6" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="text-right">
            {/* NEW: Button now opens modal instead of window.confirm */}
            <button
              onClick={() => setShowResetConfirm(true)}
              className="text-xs text-red-300 hover:text-red-500 flex items-center gap-1 justify-end w-full px-2 transition-colors"
            >
              <RefreshCcw className="w-3 h-3" /> 重置所有数据
            </button>
          </div>

          {/* Settings Panel Moved Here */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100 p-6">
            <h3 className="font-bold text-lg flex items-center gap-2 text-gray-800 mb-4">
              <Settings className="w-5 h-5 text-gray-500" /> 系统设置
            </h3>

            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div>
                  <div className="font-bold text-gray-800">开启预约功能</div>
                  <div className="text-xs text-gray-500">
                    开启后家长才能看到“领取号码”按钮
                  </div>
                </div>
                <button
                  onClick={() => setFormBookingEnabled(!formBookingEnabled)}
                  className={`w-14 h-8 rounded-full transition-colors relative ${
                    formBookingEnabled ? "bg-green-500" : "bg-gray-300"
                  }`}
                >
                  <div
                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                      formBookingEnabled ? "translate-x-6" : ""
                    }`}
                  ></div>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    开始预约时间 (自动开启)
                  </label>
                  <div className="flex gap-2 flex-col xl:flex-row">
                    <input
                      type="date"
                      className="border p-2 rounded w-full"
                      value={bookingDate}
                      onChange={(e) => setBookingDate(e.target.value)}
                    />
                    <input
                      type="time"
                      className="border p-2 rounded w-full"
                      value={bookingTime}
                      onChange={(e) => setBookingTime(e.target.value)}
                    />
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    家长在此时间前只能看，不能领号
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    面谈开始时间 (预计时间基准)
                  </label>
                  <div className="flex gap-2 flex-col xl:flex-row">
                    <input
                      type="date"
                      className="border p-2 rounded w-full"
                      value={interviewDate}
                      onChange={(e) => setInterviewDate(e.target.value)}
                    />
                    <input
                      type="time"
                      className="border p-2 rounded w-full"
                      value={interviewTime}
                      onChange={(e) => setInterviewTime(e.target.value)}
                    />
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    用于计算第一位家长的预计到达时间
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSaveSettings}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 shadow w-full xl:w-auto"
                >
                  保存设置
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-red-900/20 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">严重警告</h3>
              <p className="text-sm text-gray-500">
                您确定要重置系统吗？此操作将
                <span className="font-bold text-red-600">永久删除</span>
                以下所有内容且无法恢复：
              </p>
              <ul className="text-xs text-left bg-red-50 p-3 rounded-lg mt-4 w-full space-y-2 text-red-800 border border-red-100">
                <li className="flex items-center gap-2">
                  <Trash2 className="w-3 h-3" /> 所有排队号码与面谈记录
                </li>
                <li className="flex items-center gap-2">
                  <Trash2 className="w-3 h-3" /> 所有家长填写的建议与问题资料
                </li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition disabled:opacity-50"
                disabled={isResetting}
              >
                取消
              </button>
              <button
                onClick={executeReset}
                className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg transition flex justify-center items-center gap-2 disabled:opacity-50"
                disabled={isResetting}
              >
                {isResetting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    删除中...
                  </>
                ) : (
                  <>确认重置</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History & Registration Data Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-lg text-gray-800">数据中心</h3>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="p-2 hover:bg-gray-200 rounded-full text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Section 1: Interview Records */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-gray-700 flex items-center gap-2">
                    <Clock className="w-4 h-4" /> 面谈记录 (
                    {completedList.length})
                  </h4>
                  <button
                    onClick={handleExportCSV}
                    className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" /> 汇出记录
                  </button>
                </div>
                <div className="border rounded-xl overflow-hidden h-64 overflow-y-auto bg-gray-50">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="p-2">号码</th>
                        <th className="p-2">学生</th>
                        <th className="p-2 text-right">时长</th>
                      </tr>
                    </thead>
                    <tbody>
                      {completedList.map((item) => (
                        <tr key={item.id} className="border-t border-gray-200">
                          <td className="p-2 font-bold">{item.number}</td>
                          <td className="p-2">{item.studentName}</td>
                          <td className="p-2 text-right font-mono">
                            {formatTimer(item.durationSeconds || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 2: Registration Data */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-gray-700 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> 家长提交资料 (
                    {registrations.length})
                  </h4>
                  <button
                    onClick={handleExportRegistrations}
                    className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" /> 汇出资料
                  </button>
                </div>
                <div className="border rounded-xl overflow-hidden h-64 overflow-y-auto bg-gray-50">
                  <div className="p-2 space-y-2">
                    {registrations.map((item) => (
                      <div
                        key={item.id}
                        className="bg-white p-3 rounded shadow-sm border border-gray-100"
                      >
                        <div className="flex justify-between font-bold text-xs text-gray-500 mb-1">
                          <span>
                            {item.parentName} ({item.studentName})
                          </span>
                          <span>
                            {item.submittedAt?.toDate().toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <div className="text-xs text-gray-700 line-clamp-2">
                          <span className="font-bold">建议:</span>{" "}
                          {item.suggestions || "无"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Parent Interface ---
function ParentInterface({
  queue,
  stats,
  current,
  settings,
  onAdminLogin,
}) {
  const [activeTab, setActiveTab] = useState("register");
  const [parentName, setParentName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [suggestions, setSuggestions] = useState("");
  const [questions, setQuestions] = useState("");

  const [searchStudentName, setSearchStudentName] = useState("");
  const [myTicketId, setMyTicketId] = useState(null);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [password, setPassword] = useState("");
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);

  // Check registration status on load
  useEffect(() => {
    const savedId = localStorage.getItem("parent_day_ticket_id");
    const isRegistered = localStorage.getItem("parent_day_registered");
    const savedParent = localStorage.getItem("parent_day_pname");
    const savedStudent = localStorage.getItem("parent_day_sname");

    if (savedId) setMyTicketId(savedId);

    // If not registered and no ticket, show modal
    if (!isRegistered && !savedId) {
      setShowRegistrationModal(true);
    } else {
      // Pre-fill if available
      if (savedParent) setParentName(savedParent);
      if (savedStudent) setStudentName(savedStudent);
    }
  }, []);

  const myTicket = useMemo(() => {
    if (!myTicketId) return null;
    return (
      queue.find((i) => i.id === myTicketId) ||
      queue.find((i) => i.status === "completed" && i.id === myTicketId) ||
      null
    );
  }, [queue, myTicketId]);

  // Registration Modal Submit
  const handleRegistrationSubmit = async (e) => {
    e.preventDefault();
    if (!parentName.trim() || !studentName) {
      alert("请填写完整资料");
      return;
    }

    try {
      await addDoc(
        collection(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "parent_day_registrations"
        ),
        {
          parentName: parentName.trim(),
          studentName: studentName,
          suggestions: suggestions.trim(),
          questions: questions.trim(),
          submittedAt: serverTimestamp(),
        }
      );

      localStorage.setItem("parent_day_registered", "true");
      localStorage.setItem("parent_day_pname", parentName.trim());
      localStorage.setItem("parent_day_sname", studentName);

      setShowRegistrationModal(false);
    } catch (err) {
      console.error(err);
      alert("提交失败，请重试");
    }
  };

  const handleSkipRegistration = () => {
    localStorage.setItem("parent_day_registered", "true");
    setShowRegistrationModal(false);
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    const cleanParent = parentName.trim();
    const cleanStudent = studentName.trim();

    if (!cleanParent || !cleanStudent) {
      alert("请填写家长姓名并选择学生姓名");
      return;
    }

    const isDuplicate = queue.some(
      (item) =>
        item.studentName === cleanStudent &&
        (item.status === "waiting" || item.status === "current")
    );

    if (isDuplicate) {
      alert(`错误：学生“${cleanStudent}”已在排队列表中，请勿重复登记。`);
      return;
    }

    const maxNumber =
      queue.length > 0 ? Math.max(...queue.map((i) => i.number)) : 3000;
    const nextNumber = Math.max(3001, maxNumber + 1);

    try {
      const docRef = await addDoc(
        collection(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "parent_day_queue"
        ),
        {
          number: nextNumber,
          studentName: cleanStudent,
          parentName: cleanParent,
          status: "waiting",
          joinedAt: serverTimestamp(),
          orderTime: serverTimestamp(),
        }
      );
      localStorage.setItem("parent_day_ticket_id", docRef.id);
      setMyTicketId(docRef.id);
    } catch (err) {
      console.error(err);
      alert("领取失败，请检查网络");
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchStudentName) {
      alert("请选择学生姓名");
      return;
    }

    const foundTicket = queue.find(
      (item) => item.studentName === searchStudentName
    );

    if (foundTicket) {
      localStorage.setItem("parent_day_ticket_id", foundTicket.id);
      setMyTicketId(foundTicket.id);
    } else {
      alert("未找到该学生的排队记录，请先领取号码。");
      setStudentName(searchStudentName);
      setActiveTab("register");
    }
  };

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (password === "qwe123") {
      onAdminLogin();
      setShowAdminLogin(false);
      setPassword("");
    } else {
      alert("密码错误");
    }
  };

  const waitStats = useMemo(() => {
    if (!myTicket || myTicket.status !== "waiting") return null;
    const waitingList = queue.filter((i) => i.status === "waiting");
    const myIndex = waitingList.findIndex((i) => i.id === myTicket.id);
    const peopleAhead = myIndex + (current ? 1 : 0);
    const estWaitSeconds = peopleAhead * stats.avgDurationSeconds;

    const now = Date.now();
    let baseTime = now;
    const interviewStartMillis = settings.interviewStartTime?.toMillis();

    if (!current) {
      if (interviewStartMillis) {
        const scheduleOffset = myIndex * stats.avgDurationSeconds * 1000;
        baseTime = interviewStartMillis;
        var estimatedArrivalTime = baseTime + scheduleOffset;
      } else {
        const today8am = new Date();
        today8am.setHours(8, 0, 0, 0);
        const scheduleOffset = myIndex * stats.avgDurationSeconds * 1000;
        estimatedArrivalTime = today8am.getTime() + scheduleOffset;
      }
    } else {
      const waitDuration = peopleAhead * stats.avgDurationSeconds * 1000;
      estimatedArrivalTime = now + waitDuration;
    }

    const arrivalTime = new Date(estimatedArrivalTime);
    const totalWaitMillis = estimatedArrivalTime - now;
    const estWaitMinutes = Math.ceil(Math.max(0, totalWaitMillis) / 1000 / 60);

    return {
      peopleAhead,
      estWaitMinutes,
      arrivalTimeStr: arrivalTime.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  }, [queue, myTicket, current, stats, settings]);

  const isNext = waitStats?.peopleAhead === 1;

  // --- Logic for Next Slot Prediction (New) ---
  const nextSlotTimeStr = useMemo(() => {
    // Calculate how many people would be ahead if I join NOW
    const waitingCount = queue.filter(
      (i) => i.status === "waiting"
    ).length;
    const peopleAheadForNewcomer = waitingCount + (current ? 1 : 0);

    const estWaitSeconds = peopleAheadForNewcomer * stats.avgDurationSeconds;

    const now = Date.now();
    let baseTime = now;
    const interviewStartMillis = settings.interviewStartTime?.toMillis();

    if (!current) {
      // Session not started yet
      if (interviewStartMillis) {
        baseTime = interviewStartMillis;
      } else {
        const today8am = new Date();
        today8am.setHours(8, 0, 0, 0);
        baseTime = today8am.getTime();
      }
      // Newcomer time = Base + (Waiters * Duration)
      const estimatedArrivalTime = baseTime + estWaitSeconds * 1000;
      return new Date(estimatedArrivalTime).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else {
      // Session running: Base is NOW
      const estimatedArrivalTime = now + estWaitSeconds * 1000;
      return new Date(estimatedArrivalTime).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  }, [queue, current, stats, settings]);

  const isBookingOpen = useMemo(() => {
    if (settings.isBookingEnabled) return true;
    if (!settings.bookingStartTime) return false;
    return Date.now() >= settings.bookingStartTime.toMillis();
  }, [settings]);

  const bookingStartTimeStr = settings.bookingStartTime
    ? settings.bookingStartTime.toDate().toLocaleString("zh-CN", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "另行通知";

  const AdminModal = () =>
    showAdminLogin ? (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-sm">
          <h3 className="text-lg font-bold mb-4 text-gray-800">教师登录</h3>
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <input
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowAdminLogin(false)}
                className="flex-1 py-3 text-gray-500 font-medium hover:bg-gray-100 rounded-xl"
              >
                取消
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700"
              >
                登录
              </button>
            </div>
          </form>
        </div>
      </div>
    ) : null;

  // Registration Modal Component
  const RegistrationModal = () =>
    showRegistrationModal ? (
      <div className="fixed inset-0 bg-indigo-900/90 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
        <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md my-auto">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <FileText className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">欢迎家长</h2>
            <p className="text-gray-500 text-sm">
              在预约之前，请先填写以下资料
            </p>
          </div>

          <form onSubmit={handleRegistrationSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                家长姓名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="请输入姓名"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                学生姓名 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  required
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none appearance-none bg-white"
                >
                  <option value="">-- 请选择 --</option>
                  {STUDENT_LIST.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <ChevronRight className="absolute right-3 top-3.5 w-5 h-5 text-gray-400 rotate-90 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                给学校/老师的建议
              </label>
              <textarea
                rows={2}
                value={suggestions}
                onChange={(e) => setSuggestions(e.target.value)}
                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                placeholder="选填"
              ></textarea>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                想提出的问题
              </label>
              <textarea
                rows={2}
                value={questions}
                onChange={(e) => setQuestions(e.target.value)}
                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                placeholder="选填，如：学习进度、行为表现..."
              ></textarea>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 shadow-lg mt-4"
            >
              提交并继续
            </button>

            <button
              type="button"
              onClick={handleSkipRegistration}
              className="w-full py-2 text-gray-400 text-sm hover:text-gray-600"
            >
              我已填写，跳过此步骤
            </button>
          </form>
        </div>
      </div>
    ) : null;

  if (!myTicketId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex flex-col relative">
        {RegistrationModal()}

        <div className="absolute top-4 left-4 z-20">
          <button
            onClick={() => setShowAdminLogin(true)}
            className="p-2 text-indigo-200 hover:text-indigo-600 transition-colors"
            title="教师入口"
          >
            <Lock className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 flex flex-col justify-center px-4 max-w-md mx-auto w-full">
          <div className="bg-white p-8 rounded-2xl shadow-xl space-y-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600"></div>

            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-2 ring-8 ring-indigo-50/50">
                <Users className="w-8 h-8" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800">
                3N班家长日签到
              </h1>

              {/* Tabs */}
              <div className="flex justify-center gap-4 mt-4 text-sm font-bold border-b border-gray-100 pb-1">
                <button
                  onClick={() => setActiveTab("register")}
                  className={`px-4 py-2 rounded-t-lg transition-colors border-b-2 ${
                    activeTab === "register"
                      ? "text-indigo-600 border-indigo-600"
                      : "text-gray-400 border-transparent hover:text-gray-600"
                  }`}
                >
                  预约号码
                </button>
                <button
                  onClick={() => setActiveTab("search")}
                  className={`px-4 py-2 rounded-t-lg transition-colors border-b-2 ${
                    activeTab === "search"
                      ? "text-indigo-600 border-indigo-600"
                      : "text-gray-400 border-transparent hover:text-gray-600"
                  }`}
                >
                  查询进度
                </button>
              </div>
            </div>

            {activeTab === "register" ? (
              <div className="space-y-4 pt-2">
                {/* Booking Status Check */}
                {isBookingOpen ? (
                  <form onSubmit={handleJoin} className="space-y-4">
                    {/* New Prediction Banner */}
                    <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-200 flex items-start gap-3">
                      <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                      <div className="text-left">
                        <div className="text-xs text-indigo-600 font-bold mb-1">
                          当前预约预计面谈时间
                        </div>
                        <div className="text-xl font-bold text-indigo-800">
                          {nextSlotTimeStr}
                        </div>
                        <div className="text-[10px] text-indigo-400 mt-1">
                          时间仅供参考，请自行决定是否现在领取
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">
                        家长姓名
                      </label>
                      <input
                        type="text"
                        value={parentName}
                        onChange={(e) => setParentName(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                        placeholder="请输入您的姓名"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">
                        学生姓名
                      </label>
                      <div className="relative">
                        <select
                          value={studentName}
                          onChange={(e) => setStudentName(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition appearance-none"
                          required
                        >
                          <option value="" disabled>
                            -- 请选择学生 --
                          </option>
                          {STUDENT_LIST.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                        <ChevronRight className="w-5 h-5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
                      </div>
                    </div>

                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex justify-between items-center text-sm mt-2">
                      <span className="text-blue-600 font-medium">
                        当前等待人数
                      </span>
                      <span className="font-bold text-blue-800 text-lg">
                        {
                          queue.filter((i) => i.status === "waiting")
                            .length
                        }{" "}
                        人
                      </span>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg shadow-lg hover:bg-indigo-700 active:scale-95 transition-transform mt-2"
                    >
                      领取号码 (接受时间)
                    </button>
                  </form>
                ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-200 border-dashed">
                    <Calendar className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <h3 className="font-bold text-gray-700">预约尚未开始</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      开放时间：{bookingStartTimeStr}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleSearch} className="space-y-4 pt-2">
                <div className="text-center text-gray-500 text-sm mb-4">
                  如果您已经领取过号码，但更换了手机或不小心关闭了页面，可以在此找回您的进度。
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">
                    学生姓名
                  </label>
                  <div className="relative">
                    <select
                      value={searchStudentName}
                      onChange={(e) => setSearchStudentName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition appearance-none"
                      required
                    >
                      <option value="" disabled>
                        -- 请选择学生 --
                      </option>
                      {STUDENT_LIST.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <ChevronRight className="w-5 h-5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-4 bg-white border-2 border-indigo-600 text-indigo-600 rounded-xl font-bold text-lg hover:bg-indigo-50 active:scale-95 transition-transform mt-2 flex items-center justify-center gap-2"
                >
                  <Search className="w-5 h-5" /> 查询号码
                </button>
              </form>
            )}
          </div>
        </div>
        <AdminModal />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-white border-b border-gray-100 p-4 flex justify-between items-center sticky top-0 z-10">
        <h1 className="font-bold text-lg flex items-center gap-2 text-gray-800">
          <Users className="w-5 h-5 text-indigo-600" /> 我的号码
        </h1>
        <button
          onClick={() => {
            if (confirm("确定要退出吗？这将清除您设备上的记录。")) {
              localStorage.removeItem("parent_day_ticket_id");
              localStorage.removeItem("parent_day_registered");
              setMyTicketId(null);
              setActiveTab("register");
              setParentName("");
              setStudentName("");
              setShowRegistrationModal(true);
            }
          }}
          className="text-xs text-gray-400 hover:text-red-500 px-2 py-1"
        >
          重置/退出
        </button>
      </header>

      <main className="flex-1 p-4 max-w-md mx-auto w-full space-y-6">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden relative border border-gray-100">
          <div
            className={`h-3 w-full ${
              current?.isPaused && myTicket?.status === "waiting"
                ? "bg-orange-500"
                : myTicket?.status === "current"
                ? "bg-green-500"
                : myTicket?.status === "waiting"
                ? isNext
                  ? "bg-orange-500"
                  : "bg-indigo-500"
                : myTicket?.status === "skipped"
                ? "bg-red-500"
                : "bg-gray-300"
            }`}
          ></div>

          <div className="p-8 text-center relative">
            {current?.isPaused && myTicket?.status === "waiting" && (
              <div className="absolute top-0 left-0 w-full bg-orange-100 text-orange-800 text-sm font-bold py-2 flex items-center justify-center gap-2 animate-pulse">
                <Pause className="w-4 h-4" /> 老师暂时有事离开，计时已暂停
              </div>
            )}

            <div className="text-7xl font-black text-gray-800 tracking-tighter mb-2 mt-4">
              {myTicket?.number}
            </div>
            <div className="flex flex-col gap-1 mb-6">
              <div className="text-lg font-bold text-gray-800">
                {myTicket?.studentName}
              </div>
              <div className="text-sm text-gray-500 flex justify-center items-center gap-1">
                <User className="w-3 h-3" /> 家长：{myTicket?.parentName}
              </div>
            </div>

            {myTicket?.status === "waiting" && (
              <>
                {isNext ? (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-700 rounded-full font-bold text-sm animate-pulse">
                    <BellRing className="w-4 h-4" /> 下一位就是您！
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full font-bold text-sm">
                    <Clock className="w-4 h-4" /> 等待叫号中
                  </div>
                )}
              </>
            )}
            {myTicket?.status === "current" && (
              <div className="inline-flex items-center gap-2 px-5 py-3 bg-green-100 text-green-700 rounded-full font-bold text-lg animate-bounce shadow-sm">
                <CheckCircle className="w-6 h-6" /> 轮到您了！请进
              </div>
            )}
            {myTicket?.status === "skipped" && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-full font-bold text-sm">
                <AlertCircle className="w-4 h-4" /> 您已过号
              </div>
            )}
            {myTicket?.status === "completed" && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-500 rounded-full font-bold text-sm">
                <CheckCircle className="w-4 h-4" /> 面谈已结束
              </div>
            )}
          </div>

          {myTicket?.status === "waiting" && waitStats && (
            <div className="bg-gray-50 p-6 border-t border-gray-100 grid grid-cols-2 gap-6 divide-x divide-gray-200">
              <div className="text-center">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                  预计面谈时间
                </div>
                <div className="text-2xl font-bold text-indigo-600 flex items-center justify-center gap-1">
                  {waitStats.arrivalTimeStr}
                </div>
                <div className="text-[10px] text-gray-400 mt-1">
                  约 {waitStats.estWaitMinutes} 分钟后
                </div>
              </div>

              <div className="text-center">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                  前方人数
                </div>
                <div className="text-2xl font-bold text-gray-800">
                  {waitStats.peopleAhead}{" "}
                  <span className="text-sm font-normal text-gray-400">人</span>
                </div>
              </div>
            </div>
          )}

          {isNext && (
            <div className="bg-orange-50 p-3 text-center text-orange-700 text-sm font-medium border-t border-orange-100">
              请在课室门口准备，马上到您。
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 tracking-wider">
            实时教室状况
          </h3>
          <div
            className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
              current?.isPaused
                ? "bg-orange-50 border-orange-200"
                : "bg-gray-50 border-gray-100"
            }`}
          >
            <span
              className={`font-medium ${
                current?.isPaused ? "text-orange-700" : "text-gray-600"
              }`}
            >
              {current?.isPaused ? "老师暂时离开" : "当前正在面谈"}
            </span>
            <span
              className={`text-3xl font-bold font-mono ${
                current?.isPaused ? "text-orange-500" : "text-indigo-600"
              }`}
            >
              {current ? current.number : "--"}
            </span>
          </div>
        </div>

        <div className="text-center text-xs text-gray-300 px-8 leading-relaxed">
          您可以关闭此页面，重新扫码即可恢复查看当前进度。
          <br />
          系统会自动记录您的号码。
        </div>
      </main>

      <div className="p-4 flex justify-end">
        <button
          onClick={() => setShowAdminLogin(true)}
          className="p-2 text-gray-300 hover:text-gray-500 transition-colors"
          title="教师入口"
        >
          <Lock className="w-4 h-4" />
        </button>
      </div>
      <AdminModal />
    </div>
  );
}