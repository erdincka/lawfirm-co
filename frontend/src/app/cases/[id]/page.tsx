'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Evidence {
    id: number;
    description: string;
    evidence_type: string;
    location_found: string;
    collected_date: string;
}

interface Document {
    id: number;
    title: string;
    content: string;
    created_date: string;
}

interface Lawyer {
    id: number;
    full_name: string;
    email: string;
    specialization: string;
}

interface CaseDetail {
    id: number;
    title: string;
    description: string;
    status: string;
    case_type: string;
    defendant_name: string;
    date_opened: string;
    lead_attorney: Lawyer;
    evidence: Evidence[];
    documents: Document[];
}

export default function CasePage() {
    const params = useParams();
    const [caseData, setCaseData] = useState<CaseDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('file', file);

        setUploading(true);
        try {
            const res = await fetch(`/api/cases/${params.id}/documents`, {
                method: 'POST',
                body: formData,
            });

            if (res.ok) {
                const newDoc = await res.json();
                setCaseData(prev => prev ? {
                    ...prev,
                    documents: [...prev.documents, newDoc]
                } : null);
            } else {
                console.error('Upload failed');
            }
        } catch (err) {
            console.error('Error uploading file', err);
        } finally {
            setUploading(false);
            // Reset input
            e.target.value = '';
        }
    };

    const handleDeleteDocument = async (docId: number, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent opening the document viewer

        if (!confirm('Are you sure you want to delete this document?')) {
            return;
        }

        try {
            const res = await fetch(`/api/cases/${params.id}/documents/${docId}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                setCaseData(prev => prev ? {
                    ...prev,
                    documents: prev.documents.filter(d => d.id !== docId)
                } : null);
            } else {
                console.error('Delete failed');
                alert('Failed to delete document');
            }
        } catch (err) {
            console.error('Error deleting document', err);
            alert('Error deleting document');
        }
    };

    // Evidence form state
    const [showEvidenceForm, setShowEvidenceForm] = useState(false);
    const [evidenceForm, setEvidenceForm] = useState({
        description: '',
        evidence_type: 'Physical',
        location_found: ''
    });
    const [addingEvidence, setAddingEvidence] = useState(false);

    const handleAddEvidence = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddingEvidence(true);

        try {
            const res = await fetch(`/api/cases/${params.id}/evidence`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(evidenceForm)
            });

            if (res.ok) {
                const newEvidence = await res.json();
                setCaseData(prev => prev ? {
                    ...prev,
                    evidence: [...prev.evidence, newEvidence]
                } : null);
                // Reset form
                setEvidenceForm({
                    description: '',
                    evidence_type: 'Physical',
                    location_found: ''
                });
                setShowEvidenceForm(false);
            } else {
                console.error('Failed to add evidence');
                alert('Failed to add evidence');
            }
        } catch (err) {
            console.error('Error adding evidence', err);
            alert('Error adding evidence');
        } finally {
            setAddingEvidence(false);
        }
    };

    // Document viewer handlers
    const handleDownloadDocument = () => {
        if (!selectedDocument) return;

        // Create a blob from the content
        const blob = new Blob([selectedDocument.content || ''], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = selectedDocument.title || 'document.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handlePrintDocument = () => {
        if (!selectedDocument) return;

        // Create a new window with the document content
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                    <head>
                        <title>${selectedDocument.title}</title>
                        <style>
                            body {
                                font-family: monospace;
                                padding: 20px;
                                white-space: pre-wrap;
                            }
                        </style>
                    </head>
                    <body>
                        <h1>${selectedDocument.title}</h1>
                        <hr>
                        <pre>${selectedDocument.content || ''}</pre>
                    </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
            }, 250);
        }
    };

    // Chat state
    const [chatMessages, setChatMessages] = useState<Array<{ role: string, content: string }>>([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [llmConfigured, setLlmConfigured] = useState<boolean | null>(null);
    const [showChat, setShowChat] = useState(false);
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [showDebug, setShowDebug] = useState(false);
    const [debugInfo, setDebugInfo] = useState<any>(null);

    // Check LLM configuration and fetch models
    useEffect(() => {
        fetch('/api/settings/')
            .then(res => res.json())
            .then(data => {
                const hasEndpoint = data.some((s: any) => s.key === 'llm_endpoint' && s.value);
                const hasKey = data.some((s: any) => s.key === 'llm_api_key' && s.value);
                const configured = hasEndpoint && hasKey;
                setLlmConfigured(configured);

                // Fetch available models if configured
                if (configured) {
                    fetch('/api/chat/models')
                        .then(res => res.json())
                        .then(modelData => {
                            setAvailableModels(modelData.models || []);
                            setSelectedModel(modelData.default || modelData.models[0] || '');
                        })
                        .catch(err => console.error('Failed to fetch models', err));
                }
            })
            .catch(() => setLlmConfigured(false));
    }, []);

    const handleChatSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim() || chatLoading) return;

        const userMessage = chatInput.trim();
        setChatInput('');

        // Add user message to chat
        const newMessages = [...chatMessages, { role: 'user', content: userMessage }];
        setChatMessages(newMessages);
        setChatLoading(true);

        try {
            const res = await fetch(`/api/chat/cases/${params.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage,
                    history: chatMessages,
                    model: selectedModel || undefined
                })
            });

            if (res.ok) {
                const data = await res.json();
                setChatMessages([...newMessages, { role: 'assistant', content: data.response }]);
                // Store debug info
                if (data.debug_info) {
                    setDebugInfo(data.debug_info);
                }
            } else {
                const error = await res.json();
                setChatMessages([...newMessages, {
                    role: 'assistant',
                    content: `Error: ${error.detail || 'Failed to get response'}`
                }]);
            }
        } catch (err) {
            setChatMessages([...newMessages, {
                role: 'assistant',
                content: 'Error: Failed to communicate with the server.'
            }]);
        } finally {
            setChatLoading(false);
        }
    };

    useEffect(() => {
        if (params.id) {
            fetch(`/api/cases/${params.id}`)
                .then((res) => res.json())
                .then((data) => {
                    setCaseData(data);
                    setLoading(false);
                })
                .catch((err) => {
                    console.error('Failed to fetch case', err);
                    setLoading(false);
                });
        }
    }, [params.id]);

    if (loading) return <div className="min-h-screen bg-slate-950 text-slate-100 p-8 flex items-center justify-center">Loading case file...</div>;
    if (!caseData) return <div className="min-h-screen bg-slate-950 text-slate-100 p-8 flex items-center justify-center">Case not found</div>;

    return (
        <main className="min-h-screen bg-slate-950 text-slate-100 p-8 relative">
            <Link href="/" className="text-amber-500 hover:text-amber-400 mb-8 inline-block">&larr; Back to Dashboard</Link>

            <header className="mb-8 border-b border-slate-800 pb-8">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-4 mb-2">
                            <h1 className="text-3xl font-bold text-white">{caseData.title}</h1>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${caseData.status === 'Open' ? 'bg-green-900/30 text-green-400 border border-green-800' :
                                caseData.status === 'Closed' ? 'bg-slate-800 text-slate-400 border border-slate-700' :
                                    'bg-amber-900/30 text-amber-400 border border-amber-800'
                                }`}>
                                {caseData.status}
                            </span>
                        </div>
                        <p className="text-slate-400">Case ID: #{caseData.id} • Opened: {new Date(caseData.date_opened).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-slate-500">Lead Attorney</div>
                        <div className="text-lg font-medium text-white">{caseData.lead_attorney?.full_name || 'Unassigned'}</div>
                        <div className="text-sm text-slate-400">{caseData.lead_attorney?.email}</div>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <section className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                        <h2 className="text-xl font-semibold mb-4 text-amber-500">Case Details</h2>
                        <div className="prose prose-invert max-w-none">
                            <p>{caseData.description}</p>
                        </div>
                        <div className="mt-6 grid grid-cols-2 gap-4">
                            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                                <div className="text-sm text-slate-500 mb-1">Defendant</div>
                                <div className="font-medium">{caseData.defendant_name}</div>
                            </div>
                            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                                <div className="text-sm text-slate-500 mb-1">Case Type</div>
                                <div className="font-medium">{caseData.case_type}</div>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-4 text-white">Evidence Log</h2>
                        <div className="space-y-4">
                            {(caseData.evidence || []).map((ev) => (
                                <div key={ev.id} className="bg-slate-900/30 border border-slate-800 rounded-lg p-4 flex justify-between items-center">
                                    <div>
                                        <div className="font-medium text-slate-200">{ev.description}</div>
                                        <div className="text-sm text-slate-500 mt-1">Found at: {ev.location_found}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-300 inline-block">{ev.evidence_type}</div>
                                        <div className="text-xs text-slate-600 mt-1">{new Date(ev.collected_date).toLocaleDateString()}</div>
                                    </div>
                                </div>
                            ))}
                            {(!caseData.evidence || caseData.evidence.length === 0) && <div className="text-slate-500 italic">No evidence logged.</div>}
                        </div>

                        {/* Add Evidence Form */}
                        {showEvidenceForm ? (
                            <form onSubmit={handleAddEvidence} className="mt-6 bg-slate-900/50 border border-slate-800 rounded-lg p-4">
                                <h3 className="text-sm font-semibold text-amber-500 mb-4">Add New Evidence</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Description</label>
                                        <input
                                            type="text"
                                            value={evidenceForm.description}
                                            onChange={(e) => setEvidenceForm({ ...evidenceForm, description: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Evidence Type</label>
                                        <select
                                            value={evidenceForm.evidence_type}
                                            onChange={(e) => setEvidenceForm({ ...evidenceForm, evidence_type: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                                        >
                                            <option value="Physical">Physical</option>
                                            <option value="Digital">Digital</option>
                                            <option value="Testimonial">Testimonial</option>
                                            <option value="Documentary">Documentary</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Location Found</label>
                                        <input
                                            type="text"
                                            value={evidenceForm.location_found}
                                            onChange={(e) => setEvidenceForm({ ...evidenceForm, location_found: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                                            required
                                        />
                                    </div>
                                    <div className="flex gap-2 pt-2">
                                        <button
                                            type="submit"
                                            disabled={addingEvidence}
                                            className="px-4 py-2 bg-amber-600 text-slate-900 font-semibold rounded hover:bg-amber-500 transition text-sm disabled:opacity-50"
                                        >
                                            {addingEvidence ? 'Adding...' : 'Add Evidence'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowEvidenceForm(false)}
                                            className="px-4 py-2 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 transition text-sm"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </form>
                        ) : (
                            <button
                                onClick={() => setShowEvidenceForm(true)}
                                className="mt-6 w-full py-2 border border-dashed border-slate-700 text-slate-500 rounded-lg hover:border-amber-500 hover:text-amber-500 transition text-sm"
                            >
                                + Add Evidence
                            </button>
                        )}
                    </section>
                </div>

                <div className="space-y-8">
                    <section className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                        <h2 className="text-xl font-semibold mb-4 text-white">Documents</h2>
                        <ul className="space-y-3">
                            {(caseData.documents || []).map((doc) => (
                                <li
                                    key={doc.id}
                                    className="flex items-center gap-3 p-3 hover:bg-slate-800 rounded-lg transition group"
                                >
                                    <div
                                        onClick={() => setSelectedDocument(doc)}
                                        className="flex items-center gap-3 flex-1 cursor-pointer"
                                    >
                                        <div className="w-10 h-10 bg-slate-800 rounded flex items-center justify-center text-slate-400 group-hover:text-amber-500 group-hover:bg-slate-700 transition">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                        </div>
                                        <div className="overflow-hidden">
                                            <div className="font-medium text-sm truncate text-slate-300 group-hover:text-white">{doc.title}</div>
                                            <div className="text-xs text-slate-500">{new Date(doc.created_date).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => handleDeleteDocument(doc.id, e)}
                                        className="opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition"
                                        title="Delete document"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                        </svg>
                                    </button>
                                </li>
                            ))}
                            {(!caseData.documents || caseData.documents.length === 0) && <div className="text-slate-500 italic">No documents attached.</div>}
                        </ul>
                        <button
                            onClick={() => document.getElementById('file-upload')?.click()}
                            className="w-full mt-6 py-2 border border-dashed border-slate-700 text-slate-500 rounded-lg hover:border-amber-500 hover:text-amber-500 transition text-sm flex items-center justify-center gap-2"
                            disabled={uploading}
                        >
                            {uploading ? (
                                <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></span>
                            ) : (
                                <span>+ Upload Document</span>
                            )}
                        </button>
                        <input
                            type="file"
                            id="file-upload"
                            className="hidden"
                            onChange={handleUpload}
                        />
                    </section>
                </div>
            </div>

            {/* AI Chat Assistant */}
            <div className="fixed bottom-8 right-8 z-40">
                {!showChat ? (
                    <button
                        onClick={() => setShowChat(true)}
                        className="bg-amber-600 text-slate-900 p-4 rounded-full shadow-2xl hover:bg-amber-500 transition flex items-center gap-2 font-semibold"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>
                        </svg>
                        <span>Ask AI</span>
                    </button>
                ) : (
                    <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-96 flex flex-col" style={{ height: '500px' }}>
                        <div className="flex justify-between items-center p-4 border-b border-slate-800">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <span className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>
                                    </svg>
                                </span>
                                Case Assistant
                            </h3>
                            <button onClick={() => setShowChat(false)} className="text-slate-400 hover:text-white">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>

                        {llmConfigured === false ? (
                            <div className="flex-1 flex items-center justify-center p-6 text-center">
                                <div>
                                    <div className="text-amber-500 mb-3">
                                        <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                                        </svg>
                                    </div>
                                    <p className="text-slate-300 mb-4">LLM endpoint not configured</p>
                                    <Link href="/admin" className="text-amber-500 hover:text-amber-400 underline text-sm">
                                        Configure in Admin →
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/50">
                                    {chatMessages.length === 0 ? (
                                        <div className="text-center text-slate-500 text-sm mt-8">
                                            Ask me anything about this case...
                                        </div>
                                    ) : (
                                        chatMessages.map((msg, idx) => (
                                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[80%] rounded-lg p-3 ${msg.role === 'user'
                                                    ? 'bg-amber-600 text-slate-900'
                                                    : 'bg-slate-800 text-slate-200'
                                                    }`}>
                                                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                    {chatLoading && (
                                        <div className="flex justify-start">
                                            <div className="bg-slate-800 rounded-lg p-3">
                                                <div className="flex gap-1">
                                                    <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></span>
                                                    <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                                                    <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {availableModels.length > 1 && (
                                    <div className="px-4 py-2 border-t border-slate-800 bg-slate-900/50">
                                        <label className="text-xs text-slate-400 mb-1 block">Model</label>
                                        <select
                                            value={selectedModel}
                                            onChange={(e) => setSelectedModel(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-amber-500"
                                        >
                                            {availableModels.map(model => (
                                                <option key={model} value={model}>{model}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Debug Panel */}
                                {debugInfo && (
                                    <div className="border-t border-slate-800 bg-slate-950/50">
                                        <button
                                            onClick={() => setShowDebug(!showDebug)}
                                            className="w-full px-4 py-2 text-left text-xs text-slate-400 hover:text-amber-500 flex items-center justify-between transition"
                                        >
                                            <span className="flex items-center gap-2">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
                                                </svg>
                                                Debug Info ({debugInfo.chunks_used} chunks, {debugInfo.message_count} messages)
                                            </span>
                                            <svg className={`w-4 h-4 transition-transform ${showDebug ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                            </svg>
                                        </button>

                                        {showDebug && (
                                            <div className="px-4 pb-4 max-h-64 overflow-y-auto text-xs space-y-3">
                                                <div>
                                                    <div className="text-amber-500 font-semibold mb-1">Model Info</div>
                                                    <div className="text-slate-400">Model: {debugInfo.model}</div>
                                                    <div className="text-slate-400">VLM: {debugInfo.is_vlm ? 'Yes' : 'No'}</div>
                                                    <div className="text-slate-400">Tokens (est): ~{debugInfo.total_tokens_estimate}</div>
                                                </div>

                                                <div>
                                                    <div className="text-amber-500 font-semibold mb-1">Context Stats</div>
                                                    <div className="text-slate-400">Documents: {debugInfo.total_documents}</div>
                                                    <div className="text-slate-400">Evidence: {debugInfo.evidence_count}</div>
                                                    {debugInfo.non_readable_documents && debugInfo.non_readable_documents.length > 0 && (
                                                        <div className="text-red-400">Non-readable: {debugInfo.non_readable_documents.length}</div>
                                                    )}
                                                </div>

                                                {debugInfo.non_readable_documents && debugInfo.non_readable_documents.length > 0 && (
                                                    <div>
                                                        <div className="text-red-500 font-semibold mb-1">Non-Readable Documents</div>
                                                        <div className="bg-slate-900 p-2 rounded text-xs">
                                                            {debugInfo.non_readable_documents.map((doc: string, idx: number) => (
                                                                <div key={idx} className="text-red-400">• {doc}</div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                <div>
                                                    <div className="text-amber-500 font-semibold mb-1">System Message</div>
                                                    <div className="bg-slate-900 p-2 rounded text-slate-400 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                                                        {debugInfo.system_message}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <form onSubmit={handleChatSubmit} className="p-4 border-t border-slate-800">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={chatInput}
                                            onChange={(e) => setChatInput(e.target.value)}
                                            placeholder="Ask about this case..."
                                            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                                            disabled={chatLoading}
                                        />
                                        <button
                                            type="submit"
                                            disabled={chatLoading || !chatInput.trim()}
                                            className="bg-amber-600 text-slate-900 px-4 py-2 rounded-lg hover:bg-amber-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                                            </svg>
                                        </button>
                                    </div>
                                </form>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Document Viewer Modal */}
            {selectedDocument && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedDocument(null)}>
                    <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-6 border-b border-slate-800">
                            <h3 className="text-xl font-bold text-white flex items-center gap-3">
                                <span className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                </span>
                                {selectedDocument.title}
                            </h3>
                            <button
                                onClick={() => setSelectedDocument(null)}
                                className="text-slate-400 hover:text-white transition"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        <div className="p-8 overflow-y-auto bg-slate-950/50 font-mono text-slate-300 leading-relaxed whitespace-pre-wrap">
                            {selectedDocument.content}
                        </div>
                        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end gap-3 rounded-b-xl">
                            <button
                                onClick={handleDownloadDocument}
                                className="px-4 py-2 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 transition text-sm flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                                </svg>
                                Download
                            </button>
                            <button
                                onClick={handlePrintDocument}
                                className="px-4 py-2 bg-amber-600 text-slate-900 font-semibold rounded hover:bg-amber-500 transition text-sm flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
                                </svg>
                                Print
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
