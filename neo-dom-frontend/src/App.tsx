import { useState, useEffect, FormEvent, useRef } from 'react';
import axios from 'axios';

// ==========================================================
// API КЛИЕНТ
// ==========================================================
const apiClient = axios.create({ baseURL: 'http://localhost:3000' });

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ==========================================================
// ИНТЕРФЕЙСЫ
// ==========================================================
interface Message {
  role: 'user' | 'model';
  content: string;
  createdAt?: string;
}

type ChatMode = 'chat' | 'docs';

interface TemplateField {
  tag: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'loop';
  placeholder?: string;
  subFields?: TemplateField[];
}

interface Template {
  id: string;
  name: string;
  language: string;
  fields: TemplateField[];
}

interface TemplateData {
  id: string;
  name: string;
  fields: TemplateField[];
}

interface FormData {
  [key: string]: string | Record<string, string>[];
}

interface PaymentTarget {
  type: 'all' | 'single';
  id?: number;
  amount: number;
}

interface Receipt {
  id: number;
  category: string;
  provider: string;
  amount: number;
  status: 'paid' | 'unpaid';
}

interface ArchiveItem {
  month: string;
  total: number;
  details: Receipt[];
}

interface ReceiptData {
  current: Receipt[];
  archive: ArchiveItem[];
  total_debt: number;
}

interface Event {
  id: number;
  title: string;
  date: Date;
  type: 'meeting' | 'maintenance' | 'repair' | 'event';
}

interface Announcement {
  id: number;
  text: string;
}

interface DashboardData {
  events: Event[];
  announcements: Announcement[];
}

interface Task {
  id: number;
  title: string;
  status: 'open' | 'closed';
  createdAt: string;
}

interface UserProfile {
  email: string;
  subscription: {
    isActive: boolean;
  };
}

// ==========================================================
// КОМПОНЕНТ ДЛЯ ГЕНЕРАЦИИ ДОКУМЕНТОВ
// ==========================================================
function DocumentGenerator() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateData | null>(null);
  const [formData, setFormData] = useState<FormData>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isTemplateLoading, setIsTemplateLoading] = useState(false);
  const [isSigned, setIsSigned] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await apiClient.get('/documents/templates');
        setTemplates(response.data);
      } catch (err) {
        setError('Не удалось загрузить список шаблонов.');
      }
    };
    fetchTemplates();
  }, []);

  const handleSelectTemplate = async (templateId: string) => {
    setIsTemplateLoading(true);
    setError('');
    try {
      const templateInfo = templates.find(t => t.id === templateId);
      if (!templateInfo) throw new Error('Шаблон не найден');

      const response = await apiClient.get(`/documents/templates/${templateId}`);
      
      const fullTemplateData = { ...templateInfo, fields: response.data };

      const initialFormData: FormData = {};
      response.data.forEach((field: TemplateField) => {
        initialFormData[field.tag] = field.type === 'loop' ? [{}] : '';
      });
      
      setFormData(initialFormData);
      setSelectedTemplate(fullTemplateData);
      setIsSigned(false);
    } catch (err) {
      setError('Не удалось загрузить поля шаблона.');
    } finally {
      setIsTemplateLoading(false);
    }
  };

  const handleInputChange = (tag: string, value: string, loopIndex?: number, subFieldTag?: string) => {
    setFormData(prev => {
      if (loopIndex !== undefined && subFieldTag) {
        const currentLoopData = prev[tag] as Record<string, string>[] || [];
        const newLoopData = [...currentLoopData];
        newLoopData[loopIndex] = { ...(newLoopData[loopIndex] || {}), [subFieldTag]: value };
        return { ...prev, [tag]: newLoopData };
      }
      return { ...prev, [tag]: value };
    });
  };

  const addLoopItem = (tag: string) => {
    setFormData(prev => ({ 
      ...prev, 
      [tag]: [...((prev[tag] as Record<string, string>[]) || []), {}] 
    }));
  };
  
  const removeLoopItem = (tag: string, index: number) => {
     setFormData(prev => ({ 
       ...prev, 
       [tag]: ((prev[tag] as Record<string, string>[]) || []).filter((_, i: number) => i !== index) 
     }));
  };

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!isSigned) {
      setIsLoading(true);
      setTimeout(() => {
        setIsSigned(true);
        setIsLoading(false);
      }, 1500);
      return;
    }
    
    setIsLoading(true);
    setError('');
    try {
      const response = await apiClient.post(
        `/documents/generate/${selectedTemplate?.id}`, 
        { data: formData }, 
        { responseType: 'blob' }
      );
      
      const blob = new Blob([response.data], { type: response.headers['content-type'] });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = selectedTemplate?.id.split('/').pop() || 'document.docx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data) {
        const responseError = err.response.data as Blob;
        const errorText = await responseError.text();
        try {
          const errorData = JSON.parse(errorText);
          setError(errorData.message || 'Ошибка генерации документа.');
        } catch {
          setError('Ошибка генерации документа.');
        }
      } else {
         setError('Ошибка генерации документа.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isTemplateLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-slate-700 border-t-cyan-500 rounded-full animate-spin"></div>
          <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-r-purple-500 rounded-full animate-spin" style={{animationDirection: 'reverse', animationDuration: '1.5s'}}></div>
        </div>
        <p className="mt-6 text-lg font-medium bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
          Загрузка шаблона...
        </p>
      </div>
    );
  }

  if (!selectedTemplate) {
    return (
      <div className="w-full space-y-8">
        {error && (
          <div className="bg-gradient-to-r from-red-500/10 to-pink-500/10 border border-red-500/50 backdrop-blur-sm text-red-400 px-6 py-4 rounded-2xl text-center animate-pulse shadow-lg shadow-red-500/10">
            <div className="flex items-center justify-center gap-2">
              <span className="text-xl">⚠️</span>
              <span className="font-medium">{error}</span>
            </div>
          </div>
        )}


        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {templates.map((template, index) => (
            <div 
              key={template.id} 
              className="group relative bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl cursor-pointer transition-all duration-500 hover:border-cyan-500/50 hover:shadow-2xl hover:shadow-cyan-500/10 overflow-hidden"
              onClick={() => handleSelectTemplate(template.id)}
              style={{animationDelay: `${index * 100}ms`}}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-700 ease-out"></div>
              
              <div className="relative p-8 flex flex-col items-center text-center gap-6 h-full">
                <div className="relative">
                  <div className="text-5xl group-hover:scale-110 transition-transform duration-500 filter drop-shadow-lg">📄</div>
                  <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                </div>
                
                <div className="flex-1 space-y-3">
                  <h3 className="text-xl font-bold text-white group-hover:text-cyan-400 transition-colors duration-300">
                    {template.name}
                  </h3>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8">
      <div className="flex items-center gap-6">
        <button 
          onClick={() => { 
            setSelectedTemplate(null); 
            setIsSigned(false); 
          }} 
          className="group flex items-center gap-3 bg-gradient-to-r from-slate-800 to-slate-700 border border-slate-600 text-white px-6 py-3 rounded-2xl transition-all duration-300 hover:from-slate-700 hover:to-slate-600 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10 hover:-translate-y-1"
        >
          <span className="text-lg group-hover:-translate-x-1 transition-transform duration-300">←</span>
          <span className="font-medium">Назад к шаблонам</span>
        </button>
      </div>
      
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 h-[70vh]">
        <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl overflow-hidden flex flex-col shadow-2xl">
          <div className="bg-gradient-to-r from-slate-800/90 to-slate-700/90 backdrop-blur-sm px-8 py-6 border-b border-slate-600/50">
            <h3 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Предпросмотр документа
            </h3>
          </div>
          <div className="flex-1 bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">
            <iframe 
              src={`http://localhost:3000/pdf_previews/${selectedTemplate.id.replace('.docx', '.pdf')}#toolbar=0`}
              className="w-full h-full border-none"
              title="PDF Preview"
            ></iframe>
            <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent pointer-events-none"></div>
          </div>
        </div>
        
        <form onSubmit={handleGenerate} className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl overflow-hidden flex flex-col shadow-2xl">
          <div className="bg-gradient-to-r from-slate-800/90 to-slate-700/90 backdrop-blur-sm px-8 py-6 border-b border-slate-600/50">
            <h3 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Заполните данные
            </h3>
          </div>
          
          <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
            <div className="space-y-8">
              {selectedTemplate.fields.map((field: TemplateField) => {
                if (field.type === 'loop') {
                  const loopData = formData[field.tag] as Record<string, string>[] || [];
                  return (
                    <div key={field.tag} className="space-y-6 border-2 border-dashed border-slate-600/50 rounded-2xl p-6 bg-gradient-to-br from-slate-800/30 to-slate-900/30 backdrop-blur-sm">
                      <label className="block text-slate-300 font-semibold text-lg mb-6">{field.label}</label>
                      <div className="space-y-6">
                        {loopData.map((item: Record<string, string>, index: number) => (
                          <div key={index} className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-sm border border-slate-600/50 rounded-2xl p-6 shadow-lg">
                            <div className="flex justify-between items-center mb-6">
                              <h4 className="text-lg font-semibold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                                Элемент #{index + 1}
                              </h4>
                              <button 
                                type="button" 
                                onClick={() => removeLoopItem(field.tag, index)} 
                                className="group w-10 h-10 bg-gradient-to-r from-red-500 to-pink-500 rounded-full text-white cursor-pointer transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/25 flex items-center justify-center font-bold text-lg"
                              >
                                <span className="group-hover:rotate-90 transition-transform duration-300">×</span>
                              </button>
                            </div>
                            <div className="space-y-4">
                              {field.subFields?.map((subField: TemplateField) => (
                                <div key={subField.tag} className="relative group">
                                  <input
                                    type={subField.type || 'text'}
                                    placeholder={subField.label}
                                    value={item[subField.tag] || ''}
                                    onChange={(e) => handleInputChange(field.tag, e.target.value, index, subField.tag)}
                                    className="w-full px-5 py-3 bg-slate-900/80 backdrop-blur-sm border-2 border-slate-600/50 rounded-xl text-white placeholder-slate-400 transition-all duration-300 focus:outline-none focus:border-cyan-500/70 focus:ring-4 focus:ring-cyan-500/10 focus:bg-slate-900 group-hover:border-slate-500"
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-purple-500/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <button 
                        type="button" 
                        onClick={() => addLoopItem(field.tag)} 
                        className="group flex items-center justify-center gap-3 w-full px-6 py-3 bg-gradient-to-r from-slate-800/50 to-slate-700/50 backdrop-blur-sm border-2 border-dashed border-slate-600/50 rounded-2xl text-slate-400 cursor-pointer transition-all duration-300 hover:border-cyan-500/50 hover:text-cyan-400 hover:bg-gradient-to-r hover:from-cyan-500/5 hover:to-purple-500/5 font-medium"
                      >
                        <span className="text-xl font-bold group-hover:scale-110 transition-transform duration-300">+</span>
                        <span>Добавить элемент</span>
                      </button>
                    </div>
                  )
                }
                return (
                  <div key={field.tag} className="space-y-3">
                    <label htmlFor={field.tag} className="block text-slate-300 font-semibold">
                      {field.label}
                    </label>
                    <div className="relative group">
                      <input
                        id={field.tag}
                        type={field.type || 'text'}
                        placeholder={field.placeholder || ''}
                        value={(formData[field.tag] as string) || ''}
                        onChange={(e) => handleInputChange(field.tag, e.target.value)}
                        className="w-full px-5 py-3 bg-slate-900/80 backdrop-blur-sm border-2 border-slate-600/50 rounded-xl text-white placeholder-slate-400 transition-all duration-300 focus:outline-none focus:border-cyan-500/70 focus:ring-4 focus:ring-cyan-500/10 focus:bg-slate-900 group-hover:border-slate-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-purple-500/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          
          {error && (
            <div className="px-8">
              <div className="bg-gradient-to-r from-red-500/10 to-pink-500/10 border border-red-500/50 backdrop-blur-sm text-red-400 px-6 py-4 rounded-2xl text-center shadow-lg shadow-red-500/10">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg">⚠️</span>
                  <span className="font-medium">{error}</span>
                </div>
              </div>
            </div>
          )}
          
          <div className="p-8 border-t border-slate-600/50 bg-gradient-to-r from-slate-800/50 to-slate-700/50 backdrop-blur-sm">
            <button 
              type="submit" 
              className="group relative w-full px-8 py-3 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 text-white border-none rounded-2xl font-bold text-lg cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-cyan-500/25 hover:-translate-y-1 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none overflow-hidden"
              disabled={isLoading}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-30"></div>
              <div className="relative flex items-center justify-center gap-3">
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>{isSigned ? 'Генерация документа...' : 'Подписание ЭЦП...'}</span>
                  </>
                ) : (
                  <>
                    <span className="text-xl group-hover:scale-110 transition-transform duration-30">
                      {isSigned ? '⚡' : '✍️'}
                    </span>
                    <span>{isSigned ? 'Сгенерировать документ' : 'Подписать ЭЦП'}</span>
                  </>
                )}
              </div>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================================
// КОМПОНЕНТ ИИ-ЧАТА
// ==========================================================
function ChatInterface() {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedHistory = localStorage.getItem('chatHistory');
    setMessages(savedHistory ? JSON.parse(savedHistory) : []);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const saveToHistory = (newMessage: Message) => {
    const savedHistory = localStorage.getItem('chatHistory');
    const historyMessages: Message[] = savedHistory ? JSON.parse(savedHistory) : [];
    const updatedHistory = [...historyMessages, { 
      ...newMessage, 
      createdAt: new Date().toISOString() 
    }];
    localStorage.setItem('chatHistory', JSON.stringify(updatedHistory));
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return new Date().toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    try {
      return new Date(dateString).toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return new Date().toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
  };

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: prompt };
    setMessages(prev => [...prev, userMessage]);
    saveToHistory(userMessage);
    
    const currentPrompt = prompt;
    setPrompt('');
    setIsLoading(true);

    try {
      const response = await apiClient.post('/ai/chat', { prompt: currentPrompt });
      const aiResponse: Message = { 
        role: 'model', 
        content: response.data.aiResponse 
      };
      setMessages(prev => [...prev, aiResponse]);
      saveToHistory(aiResponse);
    } catch (err: unknown) {
      const errorMessage: Message = { 
        role: 'model', 
        content: axios.isAxiosError(err) && err.response?.data?.message 
          ? err.response.data.message 
          : '❌ Произошла ошибка при обработке запроса' 
      };
      setMessages(prev => [...prev, errorMessage]);
      saveToHistory(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-grow min-h-0 relative">
      <div className="flex flex-col flex-grow w-full max-w-5xl mx-auto min-h-0 relative">
        <div className="flex-1 overflow-y-auto py-8 px-4 pb-40 custom-scrollbar">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center py-20 flex-1 space-y-8">
              <div className="relative">
                <div className="text-8xl opacity-80 filter drop-shadow-lg">💬</div>
                <div className="absolute -inset-8 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-full blur-2xl animate-pulse"></div>
              </div>
              <div className="space-y-4 max-w-2xl">
                <h3 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                  ИИ-Консультант по вопросам ОСИ/ЖКХ
                </h3>
                <p className="text-slate-300 text-lg leading-relaxed">
                  Задайте любой вопрос по управлению недвижимостью, ЖКХ или законодательству РК. 
                  Система предоставит детальный ответ на основе актуальных данных.
                </p>
              </div>
            </div>
          )}
          
          <div className="space-y-6">
            {messages.map((msg, index) => (
              <div 
                key={index} 
                className={`flex gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ${
                  msg.role === 'user' ? 'flex-row-reverse' : ''
                }`}
                style={{animationDelay: `${index * 100}ms`}}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg flex-shrink-0 shadow-lg ${
                  msg.role === 'user' 
                    ? 'bg-gradient-to-br from-cyan-500 to-blue-500 text-white shadow-cyan-500/25' 
                    : 'bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600 text-white shadow-slate-900/25'
                }`}>
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>
                <div className={`max-w-[75%] px-6 py-4 rounded-3xl relative backdrop-blur-sm shadow-lg ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-cyan-500 to-blue-500 text-white rounded-br-lg shadow-cyan-500/25'
                    : 'bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 text-white rounded-bl-lg shadow-slate-900/25'
                }`}>
                  <div className="leading-relaxed whitespace-pre-wrap font-medium">
                    {msg.content}
                  </div>
                  <div className={`text-xs opacity-75 mt-3 ${
                    msg.role === 'user' ? 'text-right text-cyan-100' : 'text-left text-slate-400'
                  }`}>
                    {formatTime(msg.createdAt)}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
    <div className="flex gap-4 animate-in fade-in duration-300">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600 text-white shadow-lg shadow-slate-900/25 text-lg flex-shrink-0">
        🤖
      </div>
      <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-sm border border-slate-700/50 px-6 py-4 rounded-3xl rounded-bl-lg max-w-xs flex items-center gap-4 shadow-lg shadow-slate-900/25">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce"></span>
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></span>
          <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
        </div>
        <div className="text-sm text-slate-400 font-medium">ИИ генерирует ответ...</div>
      </div>
    </div>
  )}
          </div>
          <div ref={messagesEndRef} />
        </div>
        
        <div className="fixed bottom-0 left-80 right-0 w-[calc(100%-320px)] bg-gradient-to-t from-slate-900 via-slate-900/95 to-transparent pt-8 z-20">
          <form onSubmit={handleSendMessage} className="px-4">
            <div className="max-w-5xl mx-auto">
              <div className="group relative bg-gradient-to-r from-slate-800/90 to-slate-700/90 backdrop-blur-xl border border-slate-600/50 rounded-3xl px-6 py-1 shadow-2xl transition-all duration-300 focus-within:border-cyan-500/50 focus-within:shadow-cyan-500/10">
                <div className="flex gap-4 items-center">
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Задайте вопрос по ОСИ/ЖКХ..."
                    className="flex-1 px-2 py-4 bg-transparent border-none text-white placeholder-slate-400 focus:outline-none text-base"
                    disabled={isLoading}
                  />
                  <button 
                    type="submit" 
                    className="group relative w-12 h-12 bg-gradient-to-r from-cyan-500 to-blue-500 border-none rounded-2xl text-white cursor-pointer flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-cyan-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none overflow-hidden"
                    disabled={isLoading || !prompt.trim()}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <span className="relative text-lg font-bold transform group-hover:scale-110 transition-transform duration-300">→</span>
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500 text-center py-4 font-medium">
                NeoDom AI может ошибаться. Проверяйте важную информацию.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ==========================================================
// НОВЫЕ КОМПОНЕНТЫ-МОДУЛИ
// ==========================================================

function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        const response = await apiClient.get('/dashboard');
        if (response.data && response.data.events) {
          response.data.events = response.data.events.map((event: Event) => ({
            ...event,
            date: new Date(event.date),
          }));
        }
        setData(response.data);
      } catch (err) {
        console.error('Ошибка загрузки новостей: ', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const isSameDay = (d1: Date, d2: Date) =>
    d1 && d2 &&
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const generateCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const emptyCells = Array.from({ length: (firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1) });

    return (
      <div className="grid grid-cols-7 gap-2">
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => (
          <div key={d} className="text-center text-xs text-slate-400 font-bold py-3 uppercase tracking-wide">{d}</div>
        ))}
        {emptyCells.map((_, i) => <div key={`empty-${i}`} />)}
        {days.map(day => {
          const dayDate = new Date(year, month, day);
          const hasEvent = data?.events.some((event: Event) => isSameDay(event.date, dayDate));
          const isToday = isSameDay(new Date(), dayDate);
          const isSelected = isSameDay(selectedDate, dayDate);
          
          return (
            <div
            key={day}
            className={`group relative flex justify-center items-center h-12 rounded-xl transition-all duration-300 cursor-pointer font-semibold text-white hover:scale-105 ${
              isToday 
                ? 'bg-gradient-to-br from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/25 scale-105' 
                : isSelected 
                  ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25' 
                  : 'hover:bg-gradient-to-br hover:from-slate-700 hover:to-slate-600'
            }`}
              onClick={() => setSelectedDate(dayDate)}
            >
              <span className="relative z-10">{day}</span>
              {hasEvent && (
                <div className={`absolute bottom-1 w-2 h-2 rounded-full shadow-sm ${
                  isToday ? 'bg-white' : isSelected ? 'bg-white' : 'bg-cyan-400'
                }`}></div>
              )}
              {(isToday || isSelected) && (
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-50"></div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-slate-700 border-t-cyan-500 rounded-full animate-spin"></div>
          <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-r-purple-500 rounded-full animate-spin" style={{animationDirection: 'reverse', animationDuration: '1.5s'}}></div>
        </div>
        <p className="mt-6 text-lg font-medium bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
          Загрузка новостей...
        </p>
      </div>
    );
  }

  const filteredEvents = data?.events.filter((event: Event) => isSameDay(event.date, selectedDate));

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl p-8 rounded-3xl border border-slate-700/50 shadow-2xl">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Календарь событий
            </h3>
            <div className="flex items-center gap-4">
              <button 
                className="group w-12 h-12 bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600 text-white rounded-2xl cursor-pointer transition-all duration-300 hover:from-cyan-500 hover:to-blue-500 hover:border-cyan-500 hover:shadow-lg hover:shadow-cyan-500/25 hover:scale-105 flex items-center justify-center font-bold"
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
              >
                <span className="group-hover:-translate-x-0.5 transition-transform duration-300">←</span>
              </button>
              <div className="text-lg font-bold text-white min-w-[200px] text-center bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-2 rounded-xl border border-slate-600">
  {(() => {
    const month = currentDate.toLocaleString('ru-RU', { month: 'long' });
    const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1);
    return `${capitalizedMonth} ${currentDate.getFullYear()} г.`;
  })()}
</div>
              <button 
                className="group w-12 h-12 bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600 text-white rounded-2xl cursor-pointer transition-all duration-300 hover:from-cyan-500 hover:to-blue-500 hover:border-cyan-500 hover:shadow-lg hover:shadow-cyan-500/25 hover:scale-105 flex items-center justify-center font-bold"
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
              >
                <span className="group-hover:translate-x-0.5 transition-transform duration-300">→</span>
              </button>
            </div>
          </div>
          {generateCalendar()}
        </div>
        
        <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl p-8 rounded-3xl border border-slate-700/50 shadow-2xl">
          <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-6">
            События на {selectedDate.toLocaleDateString('ru-RU')}
          </h3>
          {filteredEvents && filteredEvents.length > 0 ? (
            <div className="space-y-4">
              {filteredEvents.map((event: Event, index: number) => (
                <div 
                  key={event.id} 
                  className={`group flex items-center gap-4 px-6 py-3 bg-gradient-to-r from-slate-800/60 to-slate-900/60 backdrop-blur-sm rounded-2xl border-l-4 transition-all duration-300 hover:from-slate-700/60 hover:to-slate-800/60 hover:translate-x-2 hover:shadow-lg ${
                    event.type === 'meeting' ? 'border-amber-400 hover:shadow-amber-400/10' : ''
                  } ${
                    event.type === 'maintenance' ? 'border-red-400 hover:shadow-red-400/10' : ''
                  } ${
                    event.type === 'repair' ? 'border-purple-400 hover:shadow-purple-400/10' : ''
                  } ${
                    event.type === 'event' ? 'border-emerald-400 hover:shadow-emerald-400/10' : ''
                  }`}
                  style={{animationDelay: `${index * 100}ms`}}
                >
                  <div className={`w-3 h-3 rounded-full ${
                    event.type === 'meeting' ? 'bg-amber-400' : ''
                  } ${
                    event.type === 'maintenance' ? 'bg-red-400' : ''
                  } ${
                    event.type === 'repair' ? 'bg-purple-400' : ''
                  } ${
                    event.type === 'event' ? 'bg-emerald-400' : ''
                  } shadow-lg group-hover:scale-110 transition-transform duration-300`}></div>
                  <div className="font-medium text-white flex-1 group-hover:text-cyan-400 transition-colors duration-300">
                    {event.title}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-4">
              <p className="font-medium">На выбранную дату событий нет</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl p-8 rounded-3xl border border-slate-700/50 shadow-2xl">
        <h3 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent mb-6">
          Объявления
        </h3>
        <div className="space-y-4">
          {data?.announcements?.map((a: Announcement, index: number) => (
            <div 
              key={a.id} 
              className="group flex items-center gap-4 p-3 bg-gradient-to-r from-slate-800/60 to-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-700/50 transition-all duration-300 hover:from-slate-700/60 hover:to-slate-800/60 hover:border-slate-600 hover:shadow-lg hover:translate-y-[-2px]"
              style={{animationDelay: `${index * 100}ms`}}
            >
              <div className="text-2xl mt-1 group-hover:scale-110 transition-transform duration-300">📢</div>
              <div className="leading-relaxed text-white font-medium group-hover:text-cyan-400 transition-colors duration-300">
                {a.text}
              </div>
            </div>
          )) || (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-4">
              <div className="text-4xl opacity-60">📢</div>
              <p className="font-medium">Объявлений пока нет</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Receipts() {
  const [data, setData] = useState<ReceiptData>({ 
    current: [], 
    archive: [], 
    total_debt: 0 
  });
  const [isLoading, setIsLoading] = useState(true);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/receipts');
      setData(res.data);
    } catch (error) { 
      console.error(error); 
    } finally { 
      setIsLoading(false); 
    }
  };

  useEffect(() => { 
    fetchData(); 
  }, []);

  const handlePaySingle = (receipt: Receipt) => {
    setPaymentTarget({ type: 'single', id: receipt.id, amount: receipt.amount });
    setShowQr(true);
  };

  const handlePayAll = () => {
    setPaymentTarget({ type: 'all', amount: data.total_debt });
    setShowQr(true);
  };
  
  const handleConfirmPayment = async () => {
    if (!paymentTarget) return;

    try {
        if (paymentTarget.type === 'all') {
            await apiClient.post('/receipts/pay/all');
            setData(prevData => {
                const newData = { ...prevData };
                newData.current = newData.current.map(r => ({ ...r, status: 'paid' as const }));
                newData.total_debt = 0;
                return newData;
            });
        } else if (paymentTarget.type === 'single' && paymentTarget.id) {
            await apiClient.post(`/receipts/pay/${paymentTarget.id}`);
            fetchData();
        }
    } catch (error) {
        alert('Ошибка при выполнении оплаты.');
    }
    
    setShowQr(false);
    setPaymentTarget(null);
};

  const toggleMonth = (month: string) => {
    setExpandedMonth(expandedMonth === month ? null : month);
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-slate-700 border-t-cyan-500 rounded-full animate-spin"></div>
        <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-r-purple-500 rounded-full animate-spin" style={{animationDirection: 'reverse', animationDuration: '1.5s'}}></div>
      </div>
      <p className="mt-6 text-lg font-medium bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
        Загрузка квитанций...
      </p>
    </div>
  );

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-700">
      <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl p-8 rounded-3xl border border-slate-700/50 shadow-2xl">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <p className="text-slate-400 text-lg mb-2">Общая задолженность</p>
            <span className="text-4xl font-bold bg-gradient-to-r from-red-400 to-pink-500 bg-clip-text text-transparent">
              {new Intl.NumberFormat('ru-RU').format(data.total_debt)} ₸
            </span>
          </div>
          <button 
            onClick={handlePayAll} 
            disabled={data.total_debt === 0}
            className="group relative px-8 py-3 bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-2xl font-bold text-lg transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/25 hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <span className="relative flex items-center gap-2">
              Оплатить все
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {data.current.map((receipt, index) => (
          <div 
            key={receipt.id} 
            className={`group bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-700/50 overflow-hidden flex flex-col shadow-2xl transition-all duration-300 hover:shadow-cyan-500/10 hover:-translate-y-2 ${
              receipt.status === 'paid' ? 'opacity-70' : 'hover:border-cyan-500/50'
            }`}
            style={{animationDelay: `${index * 100}ms`}}
          >
            <div className="bg-gradient-to-r from-slate-800/90 to-slate-700/90 backdrop-blur-sm px-6 py-4 border-b border-slate-600/50">
              <h3 className="text-xl font-bold text-white group-hover:text-cyan-400 transition-colors duration-300">
                {receipt.category}
              </h3>
            </div>
            <div className="bg-gradient-to-r from-slate-700/50 to-slate-800/50 px-6 py-3">
              <p className="text-white font-medium">{receipt.provider}</p>
            </div>
            <div className="flex-1 p-6 flex flex-col justify-between">
              <div className="flex justify-between items-center mb-6">
                <span className="text-white font-medium">К оплате</span>
                <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                  {new Intl.NumberFormat('ru-RU').format(receipt.amount)} ₸
                </span>
              </div>
              {receipt.status === 'unpaid' ? (
                <button 
                  className="group relative w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white py-3 font-bold text-lg rounded-2xl transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/25 hover:-translate-y-1 overflow-hidden"
                  onClick={() => handlePaySingle(receipt)}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <span className="relative flex items-center justify-center gap-2">
                    Оплатить
                  </span>
                </button>
              ) : (
                <div className="w-full bg-gradient-to-r from-emerald-500 to-green-500 text-white py-3 text-center font-bold text-lg rounded-2xl shadow-lg shadow-emerald-500/25">
                  <span className="flex items-center justify-center gap-2">
                    Оплачено
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl p-8 rounded-3xl border border-slate-700/50 shadow-2xl">
        <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-8">
          История платежей
        </h3>
        <div className="space-y-3">
          {data.archive.map((item, index) => (
            <div key={item.month} style={{animationDelay: `${index * 100}ms`}}>
              <div 
                className="group flex justify-between items-center bg-gradient-to-r from-slate-800/60 to-slate-900/60 backdrop-blur-sm px-8 py-4 rounded-2xl cursor-pointer transition-all duration-300 hover:from-slate-700/60 hover:to-slate-800/60 hover:shadow-lg border border-slate-700/50 hover:border-slate-600"
                onClick={() => toggleMonth(item.month)}
              >
                <div className="flex items-center gap-4">
                  <span className={`text-cyan-400 transition-transform duration-300 ${expandedMonth === item.month ? 'rotate-90' : ''} group-hover:text-cyan-300`}>
                  ▶
                  </span>
                  <span className="font-semibold text-white group-hover:text-cyan-400 transition-colors duration-300">
                    {item.month}
                  </span>
                </div>
                <span className="text-slate-400 font-medium group-hover:text-white transition-colors duration-300">
                  {new Intl.NumberFormat('ru-RU').format(item.total)} ₸
                </span>
              </div>
              {expandedMonth === item.month && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6 pl-12 animate-in fade-in slide-in-from-top-4 duration-500">
                  {item.details.map((detail: Receipt, detailIndex: number) => (
                    <div 
                      key={detail.id} 
                      className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-sm rounded-2xl border-l-4 border-cyan-400 shadow-lg overflow-hidden"
                      style={{animationDelay: `${detailIndex * 50}ms`}}
                    >
                      <div className="px-6 py-3 bg-gradient-to-r from-slate-800/50 to-slate-700/50">
                        <h3 className="font-bold text-white">{detail.category}</h3>
                      </div>
                      <div className="px-6 py-3 flex justify-between items-center">
                        <span className="text-slate-400 font-medium">Сумма</span>
                        <span className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                          {new Intl.NumberFormat('ru-RU').format(detail.amount)} ₸
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {showQr && paymentTarget && (
        <>
          {/* Полупрозрачный фон (оверлей) */}
          <div 
            className="fixed inset-0 backdrop-blur-sm z-50 animate-in fade-in"
            onClick={() => setShowQr(false)}
          />
          
          {/* Само модальное окно, теперь центрируется независимо */}
          <div className="fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm p-2"> {/* max-w-md -> max-w-sm */}
            <div className="bg-gradient-to-br from-slate-800/95 to-slate-900/95 backdrop-blur-xl p-6 rounded-3xl border border-slate-700/50 text-center shadow-2xl animate-in fade-in zoom-in duration-300"> {/* p-8 -> p-6 */}
              
              <h3 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent mb-3"> {/* text-3xl -> text-2xl, mb-4 -> mb-3 */}
                Оплата через Kaspi.kz
              </h3>
              
              <p className="text-sm text-slate-300 mb-4 leading-relaxed"> {/* Добавлен text-sm, mb-6 -> mb-4 */}
                Отсканируйте QR-код для быстрой и безопасной оплаты
              </p>
              
              <div className="relative mb-4"> {/* mb-6 -> mb-4 */}
                <img 
                  src="/kaspi-qr.png" 
                  alt="Kaspi QR Code" 
                  className="w-56 h-56 mx-auto object-cover rounded-2xl shadow-2xl border-4 border-slate-700" /* w-64 h-64 -> w-56 h-56 */
                />
                <div className="absolute -inset-3 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 rounded-3xl blur-lg animate-pulse"></div> {/* -inset-4 -> -inset-3, blur-xl -> blur-lg */}
              </div>
              
              <div className="text-lg mb-3 p-3 bg-gradient-to-r from-slate-800/50 to-slate-700/50 rounded-2xl border border-slate-600 text-white"> {/* text-xl -> text-lg, mb-6 -> mb-5 */}
                Сумма к оплате: <strong className="bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent text-xl ml-1"> {/* text-2xl -> text-xl */}
                  {new Intl.NumberFormat('ru-RU').format(paymentTarget.amount)} ₸
                </strong>
              </div>
              
              <div className="space-y-3"> {/* space-y-4 -> space-y-3 */}
                <button 
                  className="group relative w-full bg-gradient-to-r from-amber-500 to-yellow-500 text-white py-3 rounded-2xl font-semibold text-base transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/25 hover:-translate-y-1 overflow-hidden" /* py-4 -> py-3, text-lg -> text-base, font-bold -> font-semibold */
                  onClick={handleConfirmPayment}
                >
                  <span className="relative flex items-center justify-center gap-2">
                    Подтвердить оплату
                  </span>
                </button>
                <button 
                  className="w-full bg-transparent border-2 border-slate-600 text-slate-300 py-3 rounded-2xl font-medium text-base transition-all duration-300 hover:border-slate-500 hover:text-white hover:bg-slate-800/50" /* py-4 -> py-3, добавлен text-base */
                  onClick={() => setShowQr(false)}
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/tasks');
      setTasks(res.data);
    } catch (error) { 
      console.error("Failed to fetch tasks", error); 
    } finally { 
      setIsLoading(false); 
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await apiClient.post('/tasks', { title });
      setTitle('');
      fetchTasks();
    } catch (error) { 
      console.error("Failed to create task", error); 
    }
  };

  const openTasks = tasks.filter(t => t.status === 'open');
  const closedTasks = tasks.filter(t => t.status === 'closed');

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-700">
      <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl p-8 rounded-3xl border border-slate-700/50 shadow-2xl">
        <h3 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent mb-6">
          Создать новую заявку
        </h3>
        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 group">
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Опишите проблему или запрос..."
              className="w-full bg-slate-900/80 backdrop-blur-sm border-2 border-slate-600/50 text-white px-6 py-3 rounded-2xl text-lg placeholder-slate-400 transition-all duration-300 focus:outline-none focus:border-cyan-500/70 focus:ring-4 focus:ring-cyan-500/10 group-hover:border-slate-500"
              required
            />
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-purple-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
          </div>
          <button 
            type="submit" 
            className="group relative bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 text-white border-none px-8 py-3 rounded-2xl cursor-pointer font-bold text-lg transition-all duration-300 hover:shadow-2xl hover:shadow-cyan-500/25 hover:-translate-y-1 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <span className="relative flex items-center gap-2">
              <span className="text-xl group-hover:scale-110 transition-transform duration-300">+</span>
              Создать заявку
            </span>
          </button>
        </form>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-slate-700 border-t-cyan-500 rounded-full animate-spin"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-r-purple-500 rounded-full animate-spin" style={{animationDirection: 'reverse', animationDuration: '1.5s'}}></div>
          </div>
          <p className="mt-6 text-lg font-medium bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            Загрузка заявок...
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl p-8 rounded-3xl border border-slate-700/50 shadow-2xl">
            <h3 className="text-2xl font-bold bg-gradient-to-r from-red-400 to-pink-400 bg-clip-text text-transparent mb-6">
              Активные заявки ({openTasks.length})
            </h3>
            {openTasks.length > 0 ? (
              <div className="space-y-3">
                {openTasks.map((task, index) => (
                  <div 
                    key={task.id} 
                    className="group bg-gradient-to-r from-slate-800/60 to-slate-900/60 backdrop-blur-sm px-8 py-3 rounded-2xl flex justify-between items-center border border-slate-700/50 border-l-4 border-l-red-400 transition-all duration-300 hover:from-slate-700/60 hover:to-slate-800/60 hover:border-slate-600 hover:shadow-lg hover:shadow-red-400/10 hover:translate-x-2"
                    style={{animationDelay: `${index * 100}ms`}}
                  >
                    <div className="flex-1">
                      <p className="font-bold text-white text-lg mb-2 group-hover:text-red-400 transition-colors duration-300">
                        {task.title}
                      </p>
                      <p className="text-slate-400 font-medium">
                        Создана: {new Date(task.createdAt).toLocaleDateString('ru-RU')} • ID: #{task.id}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-bold bg-gradient-to-r from-red-500 to-pink-500 text-white px-4 py-2 rounded-full shadow-lg shadow-red-500/25">
                        ОТКРЫТА
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-4">
                <p className="font-medium">Нет активных заявок</p>
              </div>
            )}
          </div>

          <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl p-8 rounded-3xl border border-slate-700/50 shadow-2xl">
            <h3 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent mb-6">
              Закрытые заявки ({closedTasks.length})
            </h3>
            {closedTasks.length > 0 ? (
              <div className="space-y-6">
                {closedTasks.map((task, index) => (
                  <div 
                    key={task.id} 
                    className="group bg-gradient-to-r from-slate-800/60 to-slate-900/60 backdrop-blur-sm px-8 py-6 rounded-2xl flex justify-between items-center border border-slate-700/50 border-l-4 border-l-emerald-400 opacity-75 transition-all duration-300 hover:opacity-100 hover:from-slate-700/60 hover:to-slate-800/60 hover:border-slate-600 hover:shadow-lg hover:shadow-emerald-400/10"
                    style={{animationDelay: `${index * 100}ms`}}
                  >
                    <div className="flex-1">
                      <p className="font-bold text-white text-lg mb-2 group-hover:text-emerald-400 transition-colors duration-300">
                        {task.title}
                      </p>
                      <p className="text-slate-400 font-medium">
                        Создана: {new Date(task.createdAt).toLocaleDateString('ru-RU')} • ID: #{task.id}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-bold bg-gradient-to-r from-emerald-500 to-green-500 text-white px-4 py-2 rounded-full shadow-lg shadow-emerald-500/25">
                        ЗАКРЫТА
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-4">
                <p className="font-medium">Нет закрытых заявок</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================================
// ОСНОВНОЙ КОМПОНЕНТ APP
// ==========================================================
function App() {
  const [view, setView] = useState<'login' | 'register' | 'main'>('login');
  const [activeModule, setActiveModule] = useState('dashboard');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      setIsLoggedIn(true);
      setView('main');
      fetchProfile();
    }
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await apiClient.get('/users/profile');
      setUserProfile(response.data);
    } catch (err) {
      console.error("Failed to fetch profile", err);
      setUserProfile({
        email: 'user@example.com',
        subscription: { isActive: true }
      });
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await apiClient.post('/users/register', { email, password });
      alert('Регистрация прошла успешно! Теперь вы можете войти.');
      setView('login');
    } catch (err: unknown) {
      setError(axios.isAxiosError(err) && err.response?.data?.message 
        ? err.response.data.message 
        : 'Ошибка регистрации'
      );
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      const { accessToken, refreshToken } = response.data;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      setIsLoggedIn(true);
      setView('main');
      fetchProfile();
    } catch (err: unknown) {
      setError(axios.isAxiosError(err) && err.response?.data?.message 
        ? err.response.data.message 
        : 'Ошибка входа'
      );
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('chatHistory');
    setIsLoggedIn(false);
    setUserProfile(null);
    setView('login');
  };

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard':
        return <Dashboard />;
      case 'receipts':
        return <Receipts />;
      case 'tasks':
        return <Tasks />;
      case 'chat':
        return <ChatInterface />;
      case 'docs':
        return <DocumentGenerator />;
      default:
        return <Dashboard />;
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(14,165,233,0.15)_0%,transparent_50%),radial-gradient(circle_at_70%_80%,rgba(168,85,247,0.15)_0%,transparent_50%)]"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-transparent to-purple-500/5"></div>
        
        <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-2xl p-12 rounded-3xl border border-slate-700/50 w-full max-w-md shadow-2xl relative z-10 animate-in fade-in zoom-in duration-700">
          <div className="text-center mb-12 space-y-6">
            <div className="relative">
              <div className="flex items-center justify-center gap-4 mb-6">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                  NeoDom
                </h1>
              </div>
              <div className="absolute -inset-8 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-full blur-2xl opacity-50 animate-pulse"></div>
            </div>
            <p className="text-slate-300 text-lg font-medium">
              {view === 'login' ? 'Добро пожаловать в будущее управления недвижимостью!' : 'Создайте новый аккаунт'}
            </p>
          </div>
          
          <form onSubmit={view === 'login' ? handleLogin : handleRegister} className="space-y-6">
            <div className="relative group">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Введите ваш email"
                className="w-full px-5 py-3 bg-slate-900/80 backdrop-blur-sm border-2 border-slate-600/50 rounded-2xl text-white text-lg transition-all duration-300 focus:outline-none focus:border-cyan-500/70 focus:ring-4 focus:ring-cyan-500/10 placeholder-slate-400 group-hover:border-slate-500"
                required
              />
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-purple-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
            </div>
            <div className="relative group">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите пароль"
                className="w-full px-5 py-3 bg-slate-900/80 backdrop-blur-sm border-2 border-slate-600/50 rounded-2xl text-white text-lg transition-all duration-300 focus:outline-none focus:border-cyan-500/70 focus:ring-4 focus:ring-cyan-500/10 placeholder-slate-400 group-hover:border-slate-500"
                required
              />
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-purple-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
            </div>
            
            {error && (
              <div className="bg-gradient-to-r from-red-500/10 to-pink-500/10 border border-red-500/50 backdrop-blur-sm text-red-400 px-6 py-4 rounded-2xl text-center shadow-lg shadow-red-500/10 animate-in fade-in shake duration-500">
                <div className="flex items-center justify-center gap-2">
                  <span className="font-medium">{error}</span>
                </div>
              </div>
            )}
            
            <button 
              type="submit" 
              className="group relative w-full px-5 py-3 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 border-none rounded-2xl text-white text-lg font-bold cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-cyan-500/25 hover:-translate-y-1 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <span className="relative flex items-center justify-center gap-2">
                {view === 'login' ? 'Войти в систему' : 'Создать аккаунт'}
              </span>
            </button>
          </form>
          
          <div className="mt-8 text-center">
            <button 
              onClick={() => setView(view === 'login' ? 'register' : 'login')} 
              className="bg-transparent border-2 border-slate-600/50 text-cyan-400 cursor-pointer font-medium transition-all duration-300 hover:text-cyan-300 hover:border-cyan-500/50 hover:bg-cyan-500/5 px-6 py-3 rounded-2xl backdrop-blur-sm"
            >
              {view === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      <header className="bg-gradient-to-r from-slate-800/90 to-slate-700/90 backdrop-blur-xl border-b border-slate-700/50 px-8 py-6 sticky top-0 z-50 shadow-2xl">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute -inset-2 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-full blur-lg animate-pulse"></div>
              </div>
              <div className="flex flex-col">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                  NeoDom
                </h1>
                <div className="text-md text-slate-400 font-medium">
                  Цифровая платформа для управления ОСИ и ЖКХ
                </div>
              </div>
            </div>
          </div>
          
          {/* --- ЗАМЕНИТЕ НА ЭТОТ БЛОК --- */}
<div className="flex items-center bg-gradient-to-r from-slate-800/50 to-slate-700/50 backdrop-blur-sm rounded-2xl border border-slate-600/50 overflow-hidden shadow-lg">
  
  {/* Часть с профилем */}
  <div className="flex items-center gap-4 px-6 py-2">
    <div className="relative">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center font-bold text-white text-lg shadow-lg shadow-cyan-500/25">
        {userProfile?.email?.charAt(0).toUpperCase()}
      </div>
      <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/30 to-blue-500/30 rounded-2xl blur-sm"></div>
    </div>
    <div className="flex flex-col">
      <div className="font-semibold text-white">{userProfile?.email}</div>
    </div>
  </div>

  {/* Разделитель */}
  <div className="w-px h-10 bg-slate-600"></div>

  {/* Кнопка выхода */}
  <button 
    onClick={handleLogout} 
    className="group flex items-center gap-3 text-slate-300 px-6 py-4 transition-all duration-300 font-medium"
  >
    <span>Выйти</span>
  </button>

</div>
        </div>
      </header>

      <div className="flex flex-1 w-full">
        <aside className="w-80 bg-gradient-to-b from-slate-800/90 to-slate-900/90 backdrop-blur-xl border-r border-slate-700/50 p-6 sticky top-[97px] h-[calc(100vh-97px)] overflow-y-auto custom-scrollbar shadow-2xl">
          <nav className="space-y-3">
            {[
              { id: 'dashboard', label: 'Новости', gradient: 'from-cyan-500 to-blue-500' },
              { id: 'receipts', label: 'Квитанции', gradient: 'from-emerald-500 to-green-500' },
              { id: 'tasks', label: 'Заявки', gradient: 'from-amber-500 to-yellow-500' },
              { id: 'chat', label: 'ИИ Консультант', gradient: 'from-purple-500 to-pink-500' },
              { id: 'docs', label: 'Конструктор Документов', gradient: 'from-indigo-500 to-purple-500' }
            ].map((item, index) => (
              <button 
                key={item.id}
                onClick={() => setActiveModule(item.id)} 
                className={`group relative flex items-center gap-4 w-full px-6 py-3 bg-transparent border-none text-slate-300 text-left rounded-2xl cursor-pointer transition-all duration-300 overflow-hidden ${
                  activeModule === item.id 
                    ? `bg-gradient-to-r ${item.gradient} bg-opacity-20 text-white font-bold shadow-lg border-2 border-white/20` 
                    : 'hover:bg-gradient-to-r hover:from-slate-700/50 hover:to-slate-600/50 hover:text-white hover:translate-x-2 hover:shadow-lg'
                }`}
                style={{animationDelay: `${index * 100}ms`}}
              >
                <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${item.gradient} transition-transform duration-300 ${
                  activeModule === item.id ? 'scale-y-100' : 'scale-y-0 group-hover:scale-y-100'
                } origin-center`}></div>
                <span className="text-2xl group-hover:scale-110 transition-transform duration-300 filter drop-shadow-sm">
                </span>
                <span className="font-medium text-lg">{item.label}</span>
                {activeModule === item.id && (
                  <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent rounded-2xl"></div>
                )}
              </button>
            ))}
          </nav>
        </aside>
        
        <main className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(14,165,233,0.05)_0%,transparent_50%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.05)_0%,transparent_50%)]"></div>
          <div className="relative z-10 flex-1 overflow-auto custom-scrollbar p-8">
            {renderModule()}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;