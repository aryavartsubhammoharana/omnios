import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import API from '../api/client';
import { 
  ArrowLeft, Sparkles, Send, Bot, User, Book, Loader2, 
  FileText, Download, Copy, Check, ZoomIn, ZoomOut, RotateCcw,
  ChevronLeft, ChevronRight, Maximize2, Minimize2, Search, 
  Moon, Sun, Coffee, Columns, AlignLeft, BookOpen, Layers,
  ExternalLink, GraduationCap, Clock, HelpCircle, Code2, Award, Zap
} from 'lucide-react';
import MathRenderer from '../components/MathRenderer';

// ── PRE-PACKAGED DEVELOPER CURATED LIBRARY DOCUMENTS ──
const DEVELOPER_DOCUMENTS = [
  {
    id: 'dev_physics_formulas',
    filename: 'Physics & Chemistry Master Formula Sheet (NCERT & Boards)',
    category: 'Formula Sheet',
    author: 'OmniOS Academic Team',
    pages: 6,
    badgeColor: 'indigo',
    description: 'Universal constants, Ohm\'s Law, Kirchhoff\'s Laws, Coulomb\'s Law, Optics equations, and Stoichiometry quick reference.',
    content_text: `--- Page 1: Fundamental Physical Constants & Core Units ---
# Physical Constants & System of Units
$$c = 3 \\times 10^8 \\text{ m/s} \\quad (\\text{Speed of Light in Vacuum})$$
$$h = 6.626 \\times 10^{-34} \\text{ J}\\cdot\\text{s} \\quad (\\text{Planck's Constant})$$
$$e = 1.602 \\times 10^{-19} \\text{ C} \\quad (\\text{Elementary Charge})$$
$$\\varepsilon_0 = 8.854 \\times 10^{-12} \\text{ F/m} \\quad (\\text{Permittivity of Free Space})$$
$$\\mu_0 = 4\\pi \\times 10^{-7} \\text{ T}\\cdot\\text{m/A} \\quad (\\text{Permeability of Free Space})$$
$$G = 6.674 \\times 10^{-11} \\text{ N}\\cdot\\text{m}^2/\\text{kg}^2 \\quad (\\text{Gravitational Constant})$$

--- Page 2: Electrodynamics & Circuit Laws ---
# Electricity & Current Laws
### 1. Ohm's Law
$$V = I \\cdot R$$
Where:
- $V$ = Electric Potential Difference (Volts, V)
- $I$ = Current (Amperes, A)
- $R$ = Resistance (Ohms, $\\Omega$) with $R = \\rho \\frac{L}{A}$

### 2. Joule's Law of Heating
$$H = I^2 R t = V I t = \\frac{V^2}{R} t$$

### 3. Kirchhoff's Laws (Circuit Analysis)
- **Kirchhoff's Current Law (KCL - Conservation of Charge):**
$$\\sum I_{\\text{in}} = \\sum I_{\\text{out}} \\implies \\sum_{k=1}^n I_k = 0$$
- **Kirchhoff's Voltage Law (KVL - Conservation of Energy):**
$$\\sum \\Delta V = 0 \\quad (\\text{Around any closed loop})$$

--- Page 3: Optics & Wave Equations ---
# Geometric & Physical Optics
### 1. Mirror Formula & Magnification
$$\\frac{1}{f} = \\frac{1}{v} + \\frac{1}{u}$$
$$m = -\\frac{v}{u} = \\frac{h_i}{h_o}$$

### 2. Lens Maker's Formula & Thin Lens Equation
$$\\frac{1}{f} = (n - 1) \\left( \\frac{1}{R_1} - \\frac{1}{R_2} \\right)$$
$$\\frac{1}{f} = \\frac{1}{v} - \\frac{1}{u}, \\quad m = +\\frac{v}{u}$$

### 3. Snell's Law of Refraction
$$n_1 \\sin(\\theta_1) = n_2 \\sin(\\theta_2) \\implies \\frac{\\sin i}{\\sin r} = \\frac{v_1}{v_2} = \\frac{n_2}{n_1}$$

--- Page 4: Chemical Bonding & Reaction Kinetics ---
# Chemical Equations & Equilibrium
### 1. Ideal Gas Law & Universal Gas Constant
$$P V = n R T = \\frac{m}{M} R T$$
$$R = 8.314 \\text{ J}/(\\text{mol}\\cdot\\text{K}) = 0.0821 \\text{ L}\\cdot\\text{atm}/(\\text{mol}\\cdot\\text{K})$$

### 2. Nernst Equation (Electrochemistry)
$$E_{\\text{cell}} = E^\\circ_{\\text{cell}} - \\frac{R T}{n F} \\ln(Q) = E^\\circ_{\\text{cell}} - \\frac{0.0591}{n} \\log_{10}(Q) \\quad (\\text{at } 298\\text{ K})$$
`
  },
  {
    id: 'dev_class10_science_blueprint',
    filename: 'Class 10 Board Science High-Yield Blueprint (CBSE/NCERT)',
    category: 'Exam Blueprint',
    author: 'OmniOS Academic Team',
    pages: 4,
    badgeColor: 'emerald',
    description: 'Essential concepts across Physics, Chemistry & Biology: Chemical reactions, Light, Electricity, Magnetic effects, and Life Processes.',
    content_text: `--- Page 1: Chemical Reactions & Equations ---
# Chemical Reactions & Equations
### Types of Chemical Reactions:
1. **Combination Reaction:** $A + B \\rightarrow AB$ (e.g. $CaO + H_2O \\rightarrow Ca(OH)_2 + \\text{Heat}$)
2. **Decomposition Reaction:** $AB \\rightarrow A + B$ (Thermal, Electrolytic, Photolytic)
   $$2FeSO_4 \\xrightarrow{\\Delta} Fe_2O_3 + SO_2 + SO_3$$
3. **Displacement Reaction:** $A + BC \\rightarrow AC + B$ (e.g. $Fe + CuSO_4 \\rightarrow FeSO_4 + Cu$)
4. **Double Displacement:** $Na_2SO_4 + BaCl_2 \\rightarrow BaSO_4 \\downarrow + 2NaCl$ (Precipitation)
5. **Redox Reactions:** Oxidation (gain of $O$ or loss of $e^-$) and Reduction (loss of $O$ or gain of $e^-$).

--- Page 2: Electricity & Magnetic Effects ---
# Electricity & Magnetism Essentials
### Ohm's Law & Resistor Combinations
- **Series:** $R_{\\text{eq}} = R_1 + R_2 + R_3$ (Current $I$ remains identical)
- **Parallel:** $\\frac{1}{R_{\\text{eq}}} = \\frac{1}{R_1} + \\frac{1}{R_2} + \\frac{1}{R_3}$ (Voltage $V$ remains identical)

### Right-Hand Thumb Rule & Fleming's Left-Hand Rule:
- **Thumb:** Force / Motion of conductor
- **Forefinger:** Magnetic Field direction ($B$)
- **Middle Finger:** Induced / applied Current ($I$)
$$F = I \\cdot L \\cdot B \\cdot \\sin(\\theta)$$

--- Page 3: Life Processes & Biological Regulation ---
# Life Processes: Digestion, Respiration & Transport
### 1. Photosynthesis Equation:
$$6CO_2 + 12H_2O \\xrightarrow[\\text{Chlorophyll}]{\\text{Sunlight}} C_6H_{12}O_6 + 6O_2 + 6H_2O$$

### 2. Aerobic vs. Anaerobic Respiration:
- **Aerobic:** Glucose $\\rightarrow$ Pyruvate $\\rightarrow 6CO_2 + 6H_2O + 38\\text{ ATP}$ (Mitochondria)
- **Anaerobic (Yeast):** Glucose $\\rightarrow$ Ethanol $+ 2CO_2 + 2\\text{ ATP}$
- **Anaerobic (Muscle):** Glucose $\\rightarrow$ Lactic Acid $+ 2\\text{ ATP}$ (Causes cramps)
`
  },
  {
    id: 'dev_math_calculus_axioms',
    filename: 'Mathematics Derivations & Trigonometric Identities Handbook',
    category: 'Math Handbook',
    author: 'OmniOS Academic Team',
    pages: 5,
    badgeColor: 'purple',
    description: 'Quadratic equation derivations, Arithmetic Progressions, Trigonometric identities, and Coordinate Geometry theorems.',
    content_text: `--- Page 1: Algebra & Quadratic Formulas ---
# Quadratic Equations & Arithmetic Progressions
### 1. Quadratic Formula & Discriminant:
For $a x^2 + b x + c = 0$:
$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$
- $D > 0$: Two distinct real roots
- $D = 0$: Two equal real roots ($x = -b / 2a$)
- $D < 0$: No real roots (Complex conjugates)

### 2. Arithmetic Progression (AP):
- $n^{\\text{th}}$ Term: $a_n = a + (n - 1)d$
- Sum of first $n$ terms:
$$S_n = \\frac{n}{2} [2a + (n - 1)d] = \\frac{n}{2} [a + l]$$

--- Page 2: Trigonometric Identities & Ratios ---
# Trigonometry Theorems
### Fundamental Identities:
$$\\sin^2(\\theta) + \\cos^2(\\theta) = 1$$
$$1 + \\tan^2(\\theta) = \\sec^2(\\theta) \\implies \\sec^2(\\theta) - \\tan^2(\\theta) = 1$$
$$1 + \\cot^2(\\theta) = \\csc^2(\\theta) \\implies \\csc^2(\\theta) - \\cot^2(\\theta) = 1$$

### Compound Angle Formulas:
$$\\sin(A \\pm B) = \\sin(A)\\cos(B) \\pm \\cos(A)\\sin(B)$$
$$\\cos(A \\pm B) = \\cos(A)\\cos(B) \\mp \\sin(A)\\sin(B)$$
$$\\tan(A + B) = \\frac{\\tan(A) + \\tan(B)}{1 - \\tan(A)\\tan(B)}$$
`
  },
  {
    id: 'dev_omnios_ai_manual',
    filename: 'OmniOS Neural Architecture & Vision OCR Developer Manual',
    category: 'Developer Manual',
    author: 'Lead System Architect',
    pages: 4,
    badgeColor: 'sky',
    description: 'Technical specification of 4-Page 2x2 Grid Vision OCR, Dual Vector Database sync, and Groq/Gemini AI doubt-solving routing.',
    content_text: `--- Page 1: 4-Page 2x2 Grid Vision OCR Ingestion ---
# OmniOS 4-Page Batch Vision Pipeline
### 1. Dynamic Montage Stitching
$$\\text{Canvas Size} = 1500 \\times 2080 \\text{ pixels (150 DPI Render)}$$
- 4-page groups are stitched into a $2 \\times 2$ matrix with proportional letterboxing and pillarboxing.
- Reduces API consumption by **75%** while eliminating rate-limit throttling.

### 2. Model Routing & Token Optimization:
$$\\text{Ingestion Latency} \\approx 1.8\\text{s per 4-page batch}$$
- Primary: Google Gemini 2.5 Flash / Groq LLaMA Vision
- Local Fallback: Ollama Qwen2.5-VL for zero-cost offline processing.

--- Page 2: Dual Vector DB Architecture ---
# Vector Store Partitioning (Classroom vs Global)
1. **Classroom Isolated Collection**: \`classroom_{id}_store\` enforces strict tenant isolation so student data is never leaked.
2. **Global Knowledge Collection**: \`omnios_global_curriculum\` caches common textbook lemmas, formulas, and verified solutions.
`
  }
];

export default function QuickPDFReader() {
  const [searchParams, setSearchParams] = useSearchParams();
  const documentId = searchParams.get('document_id');

  // Hub States
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'classroom' | 'developer'
  const [classroomDocs, setClassroomDocs] = useState([]);
  const [loadingHub, setLoadingHub] = useState(false);
  const [hubSearch, setHubSearch] = useState('');

  // Single Document Mode States
  const [documentInfo, setDocumentInfo] = useState(null);
  const [loadingDoc, setLoadingDoc] = useState(true);
  const [aiProvider, setAiProvider] = useState('groq');
  const [copied, setCopied] = useState(false);

  // Document Viewer Controls
  const [zoomLevel, setZoomLevel] = useState(100);
  const [readerTheme, setReaderTheme] = useState('dark');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState('paginated');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const viewerContainerRef = useRef(null);

  // AI Chat Assistant States
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: 'Hello! I am your Document AI Assistant. Ask me any doubt, formula derivation, or conceptual question directly from this document.'
    }
  ]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef(null);

  // Fetch single document (Classroom or Developer)
  const fetchDoc = async () => {
    if (!documentId) {
      setLoadingDoc(false);
      return;
    }
    setLoadingDoc(true);

    // Check if it's a developer document
    if (documentId.startsWith('dev_')) {
      const devDoc = DEVELOPER_DOCUMENTS.find(d => d.id === documentId);
      if (devDoc) {
        setDocumentInfo({
          id: devDoc.id,
          filename: devDoc.filename,
          content_text: devDoc.content_text,
          processing_status: 'ready',
          is_developer_doc: true,
          category: devDoc.category,
          author: devDoc.author
        });
        setLoadingDoc(false);
        return;
      }
    }

    // Classroom document via API
    try {
      const res = await API.get(`/api/upload/document/${documentId}`);
      setDocumentInfo(res.data);
      API.post('/api/analytics/track-view', null, { params: { document_id: documentId, time_spent_seconds: 60 } }).catch(() => {});
    } catch (err) {
      console.error("Error loading document", err);
    } finally {
      setLoadingDoc(false);
    }
  };

  // Fetch classroom documents for Section 1
  const fetchClassroomDocuments = async () => {
    setLoadingHub(true);
    try {
      const classRes = await API.get('/api/classroom/list');
      const classrooms = Array.isArray(classRes.data) ? classRes.data : [];
      
      const docPromises = classrooms.map(c => 
        API.get(`/api/classroom/${c.id}`)
          .then(res => {
            const docs = res.data?.documents || [];
            return docs.map(d => ({ ...d, classroom_name: c.name, classroom_id: c.id }));
          })
          .catch(() => [])
      );

      const nestedDocs = await Promise.all(docPromises);
      setClassroomDocs(nestedDocs.flat());
    } catch (err) {
      console.error("Error fetching classroom documents", err);
    } finally {
      setLoadingHub(false);
    }
  };

  useEffect(() => {
    if (documentId) {
      fetchDoc();
    } else {
      setLoadingDoc(false);
      fetchClassroomDocuments();
    }
  }, [documentId]);

  useEffect(() => {
    if (!documentInfo || documentInfo.processing_status === 'ready' || documentInfo.is_developer_doc) return;
    const interval = setInterval(() => {
      fetchDoc();
    }, 2500);
    return () => clearInterval(interval);
  }, [documentInfo?.processing_status]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const docPages = useMemo(() => {
    if (!documentInfo?.content_text) return [];
    const text = documentInfo.content_text;
    
    if (text.includes('--- Page ')) {
      const parts = text.split(/(?=--- Page \d+)/i).filter(p => p.trim());
      if (parts.length > 0) return parts;
    }

    const paragraphs = text.split(/\n\s*\n/);
    const pages = [];
    let currentChunk = [];
    let currentLength = 0;
    const TARGET_PAGE_LENGTH = 1800;

    for (const para of paragraphs) {
      if (currentLength + para.length > TARGET_PAGE_LENGTH && currentChunk.length > 0) {
        pages.push(currentChunk.join('\n\n'));
        currentChunk = [para];
        currentLength = para.length;
      } else {
        currentChunk.push(para);
      }
    }
    if (currentChunk.length > 0) {
      pages.push(currentChunk.join('\n\n'));
    }

    return pages.length > 0 ? pages : [text];
  }, [documentInfo?.content_text]);

  const totalPages = docPages.length || 1;

  const handleCopyText = () => {
    if (documentInfo?.content_text) {
      navigator.clipboard.writeText(documentInfo.content_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 10, 160));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 10, 70));
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      viewerContainerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const handleSendQuestion = async (e) => {
    e.preventDefault();
    if (!inputQuestion.trim() || sending) return;

    const userText = inputQuestion.trim();
    setInputQuestion('');
    setMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setSending(true);

    try {
      if (documentInfo?.is_developer_doc) {
        // AI Chat directly using document text as prompt context
        const res = await API.post('/api/ai/chat', {
          question: `Context Document: ${documentInfo.filename}\n\nContent:\n${documentInfo.content_text.slice(0, 4000)}\n\nQuestion: ${userText}`,
          ai_provider: aiProvider
        });
        setMessages(prev => [
          ...prev,
          { sender: 'ai', text: res.data.answer || res.data.response, provider: res.data.provider_used || aiProvider }
        ]);
      } else {
        const res = await API.post('/api/ai/chat', {
          question: userText,
          document_id: parseInt(documentId),
          ai_provider: aiProvider
        });
        setMessages(prev => [
          ...prev,
          { sender: 'ai', text: res.data.answer, provider: res.data.provider_used }
        ]);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { sender: 'ai', text: 'Sorry, I encountered an error answering your question.' }
      ]);
    } finally {
      setSending(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 1. NO DOCUMENT SELECTED: Render 2 Sections Hub (Classroom + Developer Library)
  // ─────────────────────────────────────────────────────────────
  if (!documentId) {
    const filteredClassroomDocs = classroomDocs.filter(d => 
      (d.filename || '').toLowerCase().includes(hubSearch.toLowerCase()) ||
      (d.classroom_name || '').toLowerCase().includes(hubSearch.toLowerCase())
    );

    const filteredDevDocs = DEVELOPER_DOCUMENTS.filter(d =>
      d.filename.toLowerCase().includes(hubSearch.toLowerCase()) ||
      d.category.toLowerCase().includes(hubSearch.toLowerCase()) ||
      d.description.toLowerCase().includes(hubSearch.toLowerCase())
    );

    return (
      <div className="min-h-[calc(100vh-61px)] bg-[#090d16] text-gray-100 p-4 sm:p-8 relative overflow-hidden select-none">
        <div className="fixed top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-glow"></div>
        <div className="fixed bottom-10 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-glow"></div>

        <div className="max-w-6xl mx-auto space-y-8 relative z-10">
          {/* Top Hero Banner */}
          <div className="glass-card p-6 sm:p-8 rounded-3xl border border-gray-800/80 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center space-x-3">
                <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                  <span>Dual Document Workspace</span>
                </span>
                <span className="text-[11px] text-gray-400 font-mono">Classroom PDFs + Developer Reference Library</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Document & PDF Reader Hub
              </h1>
              <p className="text-xs sm:text-sm text-gray-400 max-w-2xl leading-relaxed">
                Read all your enrolled classroom lecture notes, plus official developer master formula sheets and blueprints with LaTeX math rendering and AI Copilot.
              </p>
            </div>

            <Link
              to="/dashboard"
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition flex items-center space-x-2 shrink-0 cursor-pointer"
            >
              <GraduationCap className="w-4 h-4" />
              <span>Browse Classrooms</span>
            </Link>
          </div>

          {/* Search Bar + Section Filter Tabs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Filter Tabs */}
            <div className="flex items-center bg-gray-900/90 border border-gray-800 p-1 rounded-2xl shadow-inner text-xs font-medium shrink-0">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3.5 py-1.5 rounded-xl transition ${
                  activeTab === 'all' ? 'bg-indigo-600 text-white font-semibold shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                All Documents ({classroomDocs.length + DEVELOPER_DOCUMENTS.length})
              </button>
              <button
                onClick={() => setActiveTab('classroom')}
                className={`px-3.5 py-1.5 rounded-xl transition flex items-center space-x-1.5 ${
                  activeTab === 'classroom' ? 'bg-indigo-600 text-white font-semibold shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Classroom PDFs ({classroomDocs.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('developer')}
                className={`px-3.5 py-1.5 rounded-xl transition flex items-center space-x-1.5 ${
                  activeTab === 'developer' ? 'bg-indigo-600 text-white font-semibold shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Developer Library ({DEVELOPER_DOCUMENTS.length})</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="flex-1 max-w-md flex items-center space-x-2 bg-gray-900/90 border border-gray-800/80 rounded-2xl px-3 py-2 shadow-inner">
              <Search className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                type="text"
                value={hubSearch}
                onChange={(e) => setHubSearch(e.target.value)}
                placeholder="Search notes, chapters, formulas..."
                className="w-full bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none"
              />
              {hubSearch && (
                <button onClick={() => setHubSearch('')} className="text-xs text-gray-400 hover:text-white">
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════
              SECTION 1: CLASSROOM PDFS & STUDY MATERIALS
              ══════════════════════════════════════════════════════ */}
          {(activeTab === 'all' || activeTab === 'classroom') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-gray-800/80">
                <div className="flex items-center space-x-2.5">
                  <div className="p-1.5 rounded-lg bg-sky-950/80 border border-sky-800/60 text-sky-400">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight">
                      Section 1: Classroom PDFs & Study Materials
                    </h2>
                    <p className="text-[11px] text-gray-400">
                      Uploaded notes, assignments, and PDFs from your enrolled classrooms
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/20">
                  {filteredClassroomDocs.length} Documents
                </span>
              </div>

              {loadingHub ? (
                <div className="py-12 flex flex-col items-center justify-center text-indigo-400 space-y-2">
                  <Loader2 className="w-7 h-7 animate-spin" />
                  <p className="text-xs text-gray-400">Loading classroom documents...</p>
                </div>
              ) : filteredClassroomDocs.length === 0 ? (
                <div className="glass-card p-8 rounded-2xl border border-gray-800/80 text-center space-y-3">
                  <FileText className="w-8 h-8 text-gray-500 mx-auto" />
                  <p className="text-xs text-gray-400">
                    {hubSearch ? 'No classroom documents match your search.' : 'No PDFs uploaded in your classrooms yet.'}
                  </p>
                  <Link to="/dashboard" className="inline-block text-xs text-indigo-400 hover:underline">
                    Go to Classrooms to upload or join
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredClassroomDocs.map((doc) => {
                    const isDocx = (doc.filename || '').endsWith('.docx') || (doc.filename || '').endsWith('.doc');
                    return (
                      <div
                        key={doc.id}
                        className="glass-card p-5 rounded-2xl border border-gray-800 hover:border-sky-500/50 hover:shadow-xl hover:shadow-sky-500/10 transition flex flex-col justify-between space-y-4 group"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div className={`p-2.5 rounded-xl border ${
                              isDocx ? 'bg-sky-950/80 text-sky-400 border-sky-800/60' : 'bg-indigo-950/80 text-indigo-400 border-indigo-800/60'
                            }`}>
                              {isDocx ? <FileText className="w-5 h-5" /> : <Book className="w-5 h-5" />}
                            </div>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-900 text-gray-400 border border-gray-800">
                              {doc.classroom_name}
                            </span>
                          </div>

                          <div>
                            <h3 className="text-sm font-bold text-white group-hover:text-sky-300 transition line-clamp-2 leading-snug">
                              {doc.filename}
                            </h3>
                            <p className="text-[11px] text-gray-400 font-medium mt-1 truncate">
                              Type: <span className="text-indigo-400 font-semibold">{isDocx ? 'Word Document' : 'Classroom PDF'}</span>
                            </p>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between">
                          <span className="text-[10px] text-gray-500 font-mono">
                            {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'Active Note'}
                          </span>
                          <Link
                            to={`/quick-reader?document_id=${doc.id}`}
                            className="px-3 py-1.5 bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white border border-sky-500/30 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 cursor-pointer shadow"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-sky-400 group-hover:text-white" />
                            <span>Read & Ask AI</span>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              SECTION 2: OTHER PDFS & REFERENCE LIBRARY BY DEVELOPER
              ══════════════════════════════════════════════════════ */}
          {(activeTab === 'all' || activeTab === 'developer') && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between pb-2 border-b border-gray-800/80">
                <div className="flex items-center space-x-2.5">
                  <div className="p-1.5 rounded-lg bg-amber-950/80 border border-amber-800/60 text-amber-400">
                    <Code2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                      <span>Section 2: Curated Reference Library & Developer Handbooks</span>
                      <span className="text-[9px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold uppercase tracking-wider">
                        Official
                      </span>
                    </h2>
                    <p className="text-[11px] text-gray-400">
                      Master formula sheets, blueprints, and engineering documentation curated by OmniOS developers
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  {filteredDevDocs.length} Developer Docs
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                {filteredDevDocs.map((dev) => (
                  <div
                    key={dev.id}
                    className="glass-card p-6 rounded-2xl border border-gray-800 hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/10 transition flex flex-col justify-between space-y-4 group bg-gray-950/80"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                          <Zap className="w-3 h-3 text-amber-400" />
                          <span>{dev.category}</span>
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {dev.pages} Pages • KaTeX Math
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition leading-snug">
                          {dev.filename}
                        </h3>
                        <p className="text-xs text-gray-400 mt-1.5 leading-relaxed line-clamp-2">
                          {dev.description}
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-800/80 flex items-center justify-between">
                      <span className="text-[10px] text-gray-500 font-mono">
                        Curated by {dev.author}
                      </span>
                      <Link
                        to={`/quick-reader?document_id=${dev.id}`}
                        className="px-4 py-2 bg-gradient-to-r from-amber-600/20 to-orange-600/20 hover:from-amber-600 hover:to-orange-600 text-amber-300 hover:text-white border border-amber-500/30 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-md"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 group-hover:text-white" />
                        <span>Open & Solve Doubts</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. SINGLE DOCUMENT MODE: Interactive 2-Column Reader + AI Chat
  // ─────────────────────────────────────────────────────────────
  if (loadingDoc) {
    return (
      <div className="h-[calc(100vh-61px)] flex flex-col items-center justify-center bg-[#090d16] text-indigo-400 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-xs text-gray-400 font-mono">Loading document...</p>
      </div>
    );
  }

  if (!documentInfo) {
    return (
      <div className="h-[calc(100vh-61px)] flex flex-col items-center justify-center bg-[#090d16] text-gray-400 space-y-3">
        <p className="text-sm font-semibold text-white">Document not found.</p>
        <Link to="/quick-reader" className="text-xs text-indigo-400 hover:underline">
          Return to Document Hub
        </Link>
      </div>
    );
  }

  const isProcessing = documentInfo.processing_status !== 'ready' && !documentInfo.is_developer_doc;
  const filename = documentInfo.filename || '';
  const isDocx = filename.endsWith('.docx') || filename.endsWith('.doc');

  let paperBg = 'bg-[#0f172a] text-gray-100 border-gray-800 shadow-2xl';
  let canvasBg = 'bg-[#090d16]';

  if (readerTheme === 'white') {
    paperBg = 'bg-[#ffffff] text-gray-900 border-gray-300 shadow-2xl';
    canvasBg = 'bg-[#e2e8f0]';
  } else if (readerTheme === 'sepia') {
    paperBg = 'bg-[#fbf0d9] text-[#433422] border-[#e6d5b8] shadow-2xl';
    canvasBg = 'bg-[#ede0c8]';
  }

  return (
    <div ref={viewerContainerRef} className="h-[calc(100vh-61px)] bg-[#090d16] text-gray-100 flex flex-col overflow-hidden relative select-text">
      {/* Top Main Navigation Header */}
      <header className="bg-gray-950/95 backdrop-blur-xl border-b border-gray-800/80 px-4 sm:px-6 py-2.5 flex items-center justify-between flex-shrink-0 z-30 shadow-lg">
        <div className="flex items-center space-x-4">
          <Link to="/quick-reader" className="flex items-center space-x-1.5 text-xs text-gray-400 hover:text-white transition">
            <ArrowLeft className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">All Documents Hub</span>
          </Link>

          <div className="h-4 w-px bg-gray-800" />

          <div className="flex items-center space-x-2.5">
            <div className={`p-1.5 rounded-lg border ${
              documentInfo.is_developer_doc 
                ? 'bg-amber-950/80 border-amber-800/50 text-amber-400' 
                : isDocx 
                ? 'bg-sky-950/80 border-sky-800/50 text-sky-400' 
                : 'bg-indigo-950/80 border-indigo-800/50 text-indigo-400'
            }`}>
              {documentInfo.is_developer_doc ? <Code2 className="w-4 h-4" /> : isDocx ? <FileText className="w-4 h-4" /> : <Book className="w-4 h-4" />}
            </div>

            <div>
              <h1 className="text-xs sm:text-sm font-bold text-white max-w-xs sm:max-w-md truncate leading-tight">
                {documentInfo.filename}
              </h1>
              <span className="text-[10px] text-gray-400 font-mono hidden sm:inline">
                {documentInfo.is_developer_doc ? `Developer Library • ${documentInfo.category}` : isDocx ? 'Word DOC' : 'PDF Document'} • {totalPages} Pages
              </span>
            </div>

            <span className={`text-[9px] px-2 py-0.5 rounded font-mono border hidden sm:inline ${
              documentInfo.is_developer_doc
                ? 'bg-amber-950 text-amber-300 border-amber-800'
                : isProcessing
                ? 'bg-amber-950 text-amber-300 border-amber-800 animate-pulse'
                : 'bg-emerald-950 text-emerald-300 border-emerald-800'
            }`}>
              {documentInfo.is_developer_doc ? 'Curated Master Doc' : isProcessing ? 'Processing OCR...' : 'Ready'}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          <button
            onClick={handleCopyText}
            className="flex items-center space-x-1.5 bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-700 text-xs px-3 py-1.5 rounded-xl transition cursor-pointer"
            title="Copy Clean Document Text"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {documentInfo.file_url && (
            <a
              href={documentInfo.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs px-3 py-1.5 rounded-xl transition shadow"
              title="Download Original File"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </a>
          )}
        </div>
      </header>

      {/* Reader Body: 2 Columns (Document Viewer Left + AI Chat Right) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT COLUMN: DOCUMENT VIEWER */}
        <div className={`flex-1 flex flex-col overflow-hidden border-r border-gray-800/80 ${canvasBg}`}>
          {/* Viewer Toolbar */}
          <div className="bg-gray-900/90 border-b border-gray-800/80 px-4 py-2 flex items-center justify-between text-xs text-gray-300 z-20">
            {/* View Mode & Page Navigation */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode(viewMode === 'paginated' ? 'continuous' : 'paginated')}
                className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition"
                title={`Switch to ${viewMode === 'paginated' ? 'Continuous Scroll' : 'Paginated View'}`}
              >
                {viewMode === 'paginated' ? <Columns className="w-3.5 h-3.5" /> : <AlignLeft className="w-3.5 h-3.5" />}
              </button>

              {viewMode === 'paginated' && (
                <div className="flex items-center space-x-1 font-mono text-[11px]">
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="p-1 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-2">
                    Page <strong className="text-white">{currentPage}</strong> of {totalPages}
                  </span>
                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="p-1 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Theme & Zoom Controls */}
            <div className="flex items-center space-x-2">
              <div className="flex items-center bg-gray-800 rounded-lg p-0.5">
                <button
                  onClick={() => setReaderTheme('dark')}
                  className={`p-1 rounded ${readerTheme === 'dark' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}
                  title="Dark Theme"
                >
                  <Moon className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setReaderTheme('sepia')}
                  className={`p-1 rounded ${readerTheme === 'sepia' ? 'bg-[#e6d5b8] text-[#433422]' : 'text-gray-400'}`}
                  title="Sepia Eye-Care Theme"
                >
                  <Coffee className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setReaderTheme('white')}
                  className={`p-1 rounded ${readerTheme === 'white' ? 'bg-white text-gray-900' : 'text-gray-400'}`}
                  title="White Paper Theme"
                >
                  <Sun className="w-3 h-3" />
                </button>
              </div>

              <div className="flex items-center space-x-1 font-mono text-[11px]">
                <button onClick={handleZoomOut} className="p-1 rounded bg-gray-800 hover:bg-gray-700" title="Zoom Out">
                  <ZoomOut className="w-3 h-3" />
                </button>
                <span className="w-10 text-center">{zoomLevel}%</span>
                <button onClick={handleZoomIn} className="p-1 rounded bg-gray-800 hover:bg-gray-700" title="Zoom In">
                  <ZoomIn className="w-3 h-3" />
                </button>
              </div>

              <button
                onClick={toggleFullscreen}
                className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition"
                title="Toggle Fullscreen"
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Document Content Canvas */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center custom-scrollbar">
            <div
              style={{
                width: `${zoomLevel}%`,
                maxWidth: '900px',
                fontSize: `${fontSize}px`
              }}
              className={`p-6 sm:p-10 rounded-2xl transition-all ${paperBg}`}
            >
              {viewMode === 'paginated' ? (
                <div className="space-y-4">
                  <div className="pb-2 border-b border-gray-700/40 flex items-center justify-between text-[11px] opacity-70 font-mono">
                    <span>Page {currentPage} of {totalPages}</span>
                    <span>{documentInfo.filename}</span>
                  </div>
                  <div className="leading-relaxed font-serif prose prose-invert max-w-none">
                    <MathRenderer content={docPages[currentPage - 1] || 'No content on this page.'} />
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  {docPages.map((p, idx) => (
                    <div key={idx} className="space-y-3 pb-6 border-b border-gray-700/30 last:border-0">
                      <span className="text-[10px] font-mono opacity-50 block">--- Page {idx + 1} ---</span>
                      <div className="leading-relaxed font-serif prose prose-invert max-w-none">
                        <MathRenderer content={p} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: AI COPILOT DOUBT SOLVER */}
        <div className="w-full lg:w-96 bg-[#0c101a] flex flex-col justify-between border-t lg:border-t-0 border-gray-800 z-10 flex-shrink-0">
          {/* AI Header */}
          <div className="p-3.5 bg-gray-950/80 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-purple-950/80 text-purple-400 rounded-lg border border-purple-800/60 shadow">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Document AI Assistant</span>
                <span className="text-[9px] text-emerald-400 font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> Live Context Synced
                </span>
              </div>
            </div>

            <select
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value)}
              className="bg-gray-900 border border-gray-800 text-[10px] text-gray-300 rounded-lg px-2 py-1 focus:outline-none"
            >
              <option value="groq">Groq LLaMA 3.3</option>
              <option value="gemini">Google Gemini</option>
              <option value="sarvam">Sarvam AI (Hindi/Regional)</option>
            </select>
          </div>

          {/* Chat Messages Log */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex items-start space-x-2.5 ${m.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}
              >
                <div className={`p-1.5 rounded-lg text-xs flex-shrink-0 ${
                  m.sender === 'user' ? 'bg-indigo-600 text-white' : 'bg-purple-950 text-purple-400 border border-purple-800/60'
                }`}>
                  {m.sender === 'user' ? <User className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                </div>
                <div className={`p-3 rounded-2xl text-xs max-w-[85%] leading-relaxed ${
                  m.sender === 'user'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-gray-900/90 text-gray-200 border border-gray-800/80 shadow-inner'
                }`}>
                  <MathRenderer content={m.text} />
                  {m.provider && (
                    <span className="block text-[9px] text-gray-500 font-mono mt-1 text-right">
                      via {m.provider}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex items-center space-x-2 text-xs text-indigo-400 p-2 bg-gray-900/60 rounded-xl w-fit">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="font-mono text-[10px]">Analyzing document & generating explanation...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Message Input Box */}
          <form onSubmit={handleSendQuestion} className="p-3 bg-gray-950/80 border-t border-gray-800 flex items-center space-x-2">
            <input
              type="text"
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              placeholder="Ask formula derivation, doubt, or summary..."
              className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition shadow-inner"
            />
            <button
              type="submit"
              disabled={sending || !inputQuestion.trim()}
              className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl shadow-md transition flex-shrink-0 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
