import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

const MedicalAgent = () => {
  const [reportText, setReportText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const [chatHistory, setChatHistory] = useState([]);
  const [chatMessage, setChatMessage] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // ✅ NAYA STATE: MongoDB ka ID store karne ke liye
  const [currentReportId, setCurrentReportId] = useState(null);
  
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const analyzeReport = async () => {
    if (!reportText.trim() && !selectedFile) {
      setError("Please enter text or upload a report image.");
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    setChatHistory([]); 
    setCurrentReportId(null); // Purani ID hatao

    try {
      const formData = new FormData();
      if (reportText) formData.append('reportText', reportText);
      if (selectedFile) formData.append('reportFile', selectedFile);

      const response = await fetch('http://localhost:3000/api/analyze-report', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error("Server error occurred");
      
      const data = await response.json();
      setResult(data);
      
      // ✅ NAYA: Backend se aayi ID ko State mein save karein
      if(data.reportId) {
          setCurrentReportId(data.reportId);
      }
      
      setChatHistory([
        { role: 'model', text: "Hello! I have analyzed your report. You can ask me any questions about it." }
      ]);
    } catch (err) {
      setError("Failed to analyze report. Please check if backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Sorry, your browser doesn't support voice input. Please use Google Chrome.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-IN'; 

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setChatMessage(prev => prev ? prev + " " + transcript : transcript);
    };
    recognition.onerror = (event) => {
      console.error("Voice recognition error:", event.error);
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const speakText = (text) => {
    if (!window.speechSynthesis) {
      alert("Sorry, your browser doesn't support Text-to-Speech.");
      return;
    }
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#_]/g, "");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-IN'; 
    utterance.rate = 1; 
    window.speechSynthesis.speak(utterance);
  };

  const sendChatMessage = async () => {
    if (!chatMessage.trim()) return;

    const newMessage = { role: 'user', text: chatMessage };
    setChatHistory((prev) => [...prev, newMessage]);
    setChatMessage('');
    setIsChatting(true);

    try {
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: newMessage.text,
          history: chatHistory.filter((msg, index) => index > 0), 
          context: result,
          reportId: currentReportId // ✅ NAYA: ID backend ko bhej rahe hain
        }),
      });

      if (!response.ok) throw new Error("Chat failed");

      const data = await response.json();
      setChatHistory((prev) => [...prev, { role: 'model', text: data.text }]);
    } catch (err) {
      setChatHistory((prev) => [...prev, { role: 'model', text: "Sorry, I am having trouble connecting to the server." }]);
    } finally {
      setIsChatting(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 flex justify-center items-start">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl overflow-hidden">
        
        <div className="bg-blue-600 p-6 text-white text-center">
            <h2 className="text-3xl font-bold tracking-wide">AI Health Companion</h2>
            <p className="text-blue-100 mt-2 text-sm">Upload your report and chat with your personal medical assistant.</p>
        </div>

        <div className="p-6">
            {!result && (
              <div className="animate-fade-in">
                <textarea
                  className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none mb-4 shadow-sm text-gray-700"
                  rows="3"
                  placeholder="Type your report values here..."
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                ></textarea>

                <div className="flex items-center justify-center w-full mb-4">
                    <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-32 border-2 border-blue-200 border-dashed rounded-xl cursor-pointer bg-blue-50 hover:bg-blue-100 transition-colors">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <svg className="w-10 h-10 mb-3 text-blue-500" fill="none" viewBox="0 0 20 16" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                            </svg>
                            <p className="mb-2 text-sm text-gray-600"><span className="font-semibold text-blue-600">Click to upload image</span> or drag and drop</p>
                        </div>
                        <input id="dropzone-file" type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                    </label>
                </div>
                
                {selectedFile && (
                    <p className="text-sm text-green-600 mb-4 font-medium flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
                        Attached: {selectedFile.name}
                    </p>
                )}

                <button
                  onClick={analyzeReport}
                  disabled={loading}
                  className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-md transition-all ${
                    loading ? 'bg-blue-300 cursor-wait' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transform hover:-translate-y-1'
                  }`}
                >
                  {loading ? 'Processing Data...' : 'Generate Analysis'}
                </button>

                {error && <div className="mt-4 p-4 bg-red-50 text-red-600 border border-red-200 rounded-xl text-center">{error}</div>}
              </div>
            )}

            {result && (
              <div className="space-y-6 animate-fade-in">
                
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center mb-3">
                        <span className="bg-blue-100 text-blue-600 p-1.5 rounded-lg mr-2">📊</span> 
                        Report Overview
                    </h3>
                    <p className="text-gray-700 leading-relaxed">{result.summary}</p>
                    
                    <div className="mt-4">
                        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Flagged Values</h4>
                        <div className="flex flex-wrap gap-2">
                            {result.abnormal_values.map((val, index) => (
                            <span key={index} className="px-3 py-1.5 bg-red-50 text-red-600 text-sm font-medium rounded-lg border border-red-100">
                                {val}
                            </span>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="border border-gray-200 rounded-2xl overflow-hidden flex flex-col h-[400px] bg-gray-50">
                    <div className="bg-white border-b border-gray-200 p-3 text-center flex justify-between items-center">
                        <span className="text-sm font-bold text-gray-600">Secure Chat Session</span>
                        {/* ✅ NAYA: Status Indicator for DB Save */}
                        {currentReportId && <span className="text-xs text-green-600 flex items-center"><span className="w-2 h-2 rounded-full bg-green-500 mr-1 animate-pulse"></span> Auto-saved</span>}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {chatHistory.map((msg, index) => (
                            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-3 rounded-2xl ${
                                    msg.role === 'user' 
                                        ? 'bg-blue-600 text-white rounded-tr-none shadow-md' 
                                        : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none shadow-sm'
                                }`}>
                                    
                                    {msg.role === 'user' ? (
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                    ) : (
                                        <div className="text-sm leading-relaxed text-gray-700">
                                            <ReactMarkdown 
                                                components={{
                                                    p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                                                    ul: ({node, ...props}) => <ul className="list-disc ml-5 mb-3 space-y-1" {...props} />,
                                                    ol: ({node, ...props}) => <ol className="list-decimal ml-5 mb-3 space-y-1" {...props} />,
                                                    li: ({node, ...props}) => <li className="text-gray-700" {...props} />,
                                                    strong: ({node, ...props}) => <strong className="font-bold text-blue-900" {...props} />
                                                }}
                                            >
                                                {msg.text}
                                            </ReactMarkdown>

                                            <button 
                                                onClick={() => speakText(msg.text)}
                                                className="mt-3 flex items-center text-xs font-semibold text-gray-400 hover:text-blue-600 transition-colors"
                                                title="Read Aloud"
                                            >
                                                <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                                                </svg>
                                                Listen
                                            </button>
                                        </div>
                                    )}

                                </div>
                            </div>
                        ))}
                        {isChatting && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-gray-200 p-4 rounded-2xl rounded-tl-none shadow-sm flex space-x-2">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    <div className="bg-white border-t border-gray-200 p-3">
                        <div className="flex items-center bg-gray-100 rounded-full p-1 pl-4 pr-1">
                            <input 
                                type="text"
                                className="flex-1 bg-transparent border-none focus:ring-0 outline-none text-sm text-gray-700"
                                placeholder={isListening ? "Listening..." : "Ask a follow-up question..."}
                                value={chatMessage}
                                onChange={(e) => setChatMessage(e.target.value)}
                                onKeyDown={handleKeyPress}
                                disabled={isChatting}
                            />

                            <button 
                                onClick={startListening}
                                disabled={isChatting || isListening}
                                title="Use Voice Input"
                                className={`p-2 mr-1 rounded-full transition-all flex items-center justify-center ${
                                    isListening 
                                        ? 'bg-red-100 text-red-600 animate-pulse' 
                                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                }`}
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                                </svg>
                            </button>

                            <button 
                                onClick={sendChatMessage}
                                disabled={isChatting || !chatMessage.trim()}
                                className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="text-xs text-gray-400 text-center font-medium">
                  * {result.disclaimer}
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default MedicalAgent;