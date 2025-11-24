'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function AdminPage() {
    const [tables, setTables] = useState<string[]>([]);
    const [selectedTable, setSelectedTable] = useState<string | null>(null);
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({ page: 1, per_page: 10, total: 0, total_pages: 0 });
    const [selectedRecord, setSelectedRecord] = useState<any>(null);

    // LLM Settings state
    const [endpoint, setEndpoint] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [savingSettings, setSavingSettings] = useState(false);
    const [settingsMessage, setSettingsMessage] = useState('');

    useEffect(() => {
        fetch('/api/admin/tables')
            .then((res) => res.json())
            .then((data) => setTables(data))
            .catch((err) => console.error('Failed to fetch tables', err));

        // Load LLM settings
        fetch('/api/settings')
            .then((res) => res.json())
            .then((data) => {
                const ep = data.find((s: any) => s.key === 'llm_endpoint');
                const key = data.find((s: any) => s.key === 'llm_api_key');
                if (ep) setEndpoint(ep.value);
                if (key) setApiKey(key.value);
            })
            .catch((err) => console.error('Failed to fetch settings', err));
    }, []);

    useEffect(() => {
        if (selectedTable) {
            // Reset to page 1 when table changes
            setPagination(prev => ({ ...prev, page: 1 }));
            fetchTableData(1);
        }
    }, [selectedTable]);

    const fetchTableData = (page: number) => {
        setLoading(true);
        fetch(`/api/admin/tables/${selectedTable}?page=${page}&per_page=${pagination.per_page}`)
            .then((res) => res.json())
            .then((data) => {
                setRecords(data.records || []);
                setPagination({
                    page: data.page,
                    per_page: data.per_page,
                    total: data.total,
                    total_pages: data.total_pages
                });
                setLoading(false);
            })
            .catch((err) => {
                console.error('Failed to fetch records', err);
                setLoading(false);
            });
    };

    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingSettings(true);
        setSettingsMessage('');

        try {
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'llm_endpoint', value: endpoint, is_secret: false }),
            });

            if (apiKey && apiKey !== '********') {
                await fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: 'llm_api_key', value: apiKey, is_secret: true }),
                });
            }

            setSettingsMessage('Settings saved successfully!');
        } catch (err) {
            console.error('Failed to save settings', err);
            setSettingsMessage('Error saving settings.');
        } finally {
            setSavingSettings(false);
        }
    };

    return (
        <main className="min-h-screen bg-slate-950 text-slate-100 p-8">
            <Link href="/" className="text-amber-500 hover:text-amber-400 mb-8 inline-block">&larr; Back to Dashboard</Link>

            <header className="mb-8 border-b border-slate-800 pb-4">
                <h1 className="text-3xl font-bold text-white">System Administration</h1>
                <p className="text-slate-400">Manage database and system settings</p>
            </header>

            {/* LLM Configuration Section */}
            <section className="mb-8 bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                <h2 className="text-xl font-semibold mb-4 text-white">AI/LLM Configuration</h2>
                <form onSubmit={handleSaveSettings} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">LLM Endpoint URL</label>
                        <input
                            type="url"
                            value={endpoint}
                            onChange={(e) => setEndpoint(e.target.value)}
                            placeholder="https://api.openai.com/v1"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-amber-500 transition"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">API Token</label>
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="sk-..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-amber-500 transition"
                        />
                        <p className="text-xs text-slate-500 mt-1">Token is stored securely and masked in the UI.</p>
                    </div>

                    {settingsMessage && (
                        <div className={`p-3 rounded-lg text-sm ${settingsMessage.includes('Error') ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
                            {settingsMessage}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={savingSettings}
                        className="bg-amber-600 text-slate-900 font-bold px-6 py-2 rounded-lg hover:bg-amber-500 transition disabled:opacity-50"
                    >
                        {savingSettings ? 'Saving...' : 'Save Configuration'}
                    </button>
                </form>
            </section>

            {/* Database Browser Section */}
            <section>
                <h2 className="text-xl font-semibold mb-4 text-white">Database Browser</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div className="md:col-span-1 bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                        <h3 className="text-lg font-semibold mb-4 text-white">Tables</h3>
                        <ul className="space-y-2">
                            {tables.map((table) => (
                                <li key={table}>
                                    <button
                                        onClick={() => setSelectedTable(table)}
                                        className={`w-full text-left px-3 py-2 rounded-lg transition ${selectedTable === table
                                            ? 'bg-amber-600 text-white'
                                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                            }`}
                                    >
                                        {table}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="md:col-span-3 bg-slate-900/50 border border-slate-800 rounded-xl p-6 overflow-x-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-semibold text-white">
                                {selectedTable ? `Records: ${selectedTable}` : 'Select a table'}
                            </h3>
                            {selectedTable && (
                                <div className="text-sm text-slate-400">
                                    Total: {pagination.total} records
                                </div>
                            )}
                        </div>

                        {loading ? (
                            <div className="text-center py-10 text-slate-500 animate-pulse">Loading records...</div>
                        ) : selectedTable && records.length > 0 ? (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm text-slate-400">
                                        <thead className="text-xs uppercase bg-slate-800 text-slate-300">
                                            <tr>
                                                {Object.keys(records[0]).map((key) => (
                                                    <th key={key} className="px-4 py-3">{key}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {records.map((record, idx) => (
                                                <tr
                                                    key={idx}
                                                    onClick={() => setSelectedRecord(record)}
                                                    className="border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer"
                                                >
                                                    {Object.values(record).map((val: any, i) => (
                                                        <td key={i} className="px-4 py-3 max-w-xs truncate">
                                                            {typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                {pagination.total_pages > 1 && (
                                    <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-800">
                                        <div className="text-sm text-slate-400">
                                            Page {pagination.page} of {pagination.total_pages}
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => fetchTableData(pagination.page - 1)}
                                                disabled={pagination.page === 1}
                                                className="px-4 py-2 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Previous
                                            </button>
                                            <button
                                                onClick={() => fetchTableData(pagination.page + 1)}
                                                disabled={pagination.page === pagination.total_pages}
                                                className="px-4 py-2 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : selectedTable ? (
                            <div className="text-slate-500 italic">No records found.</div>
                        ) : (
                            <div className="text-slate-500 italic">Please select a table from the sidebar.</div>
                        )}
                    </div>
                </div>
            </section>

            {/* Record Detail Modal */}
            {selectedRecord && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedRecord(null)}>
                    <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-6 border-b border-slate-800">
                            <h3 className="text-xl font-bold text-white flex items-center gap-3">
                                <span className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                    </svg>
                                </span>
                                Record Details
                            </h3>
                            <button
                                onClick={() => setSelectedRecord(null)}
                                className="text-slate-400 hover:text-white transition"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto bg-slate-950/50">
                            <dl className="space-y-4">
                                {Object.entries(selectedRecord).map(([key, value]: [string, any]) => (
                                    <div key={key} className="border-b border-slate-800 pb-4">
                                        <dt className="text-sm font-semibold text-amber-500 mb-1 uppercase">{key}</dt>
                                        <dd className="text-slate-300 font-mono text-sm break-all">
                                            {typeof value === 'object' && value !== null
                                                ? JSON.stringify(value, null, 2)
                                                : value === null
                                                    ? <span className="text-slate-600 italic">null</span>
                                                    : String(value)}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end rounded-b-xl">
                            <button
                                onClick={() => setSelectedRecord(null)}
                                className="px-4 py-2 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 transition"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
