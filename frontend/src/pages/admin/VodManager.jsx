import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../services/api'
import toast from 'react-hot-toast'

const VodManager = () => {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = useState('overview')
    const [loading, setLoading] = useState(true)

    // Stats
    const [vodStats, setVodStats] = useState(null)

    // Collections
    const [collections, setCollections] = useState([])
    const [collectionStats, setCollectionStats] = useState([])
    const [loadingCollectionStats, setLoadingCollectionStats] = useState(false)

    // Browse
    const [selectedCollection, setSelectedCollection] = useState('')
    const [browseItems, setBrowseItems] = useState([])
    const [browsePagination, setBrowsePagination] = useState({ page: 1, pages: 0, total: 0 })
    const [browseLoading, setBrowseLoading] = useState(false)

    // Search
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [searchLoading, setSearchLoading] = useState(false)

    // Import
    const [selectedItems, setSelectedItems] = useState([])
    const [importOptions, setImportOptions] = useState({
        skipExisting: true,
        syncSubtitles: false
    })
    const [importing, setImporting] = useState(false)
    const [importJobs, setImportJobs] = useState([])

    // Preview
    const [previewItem, setPreviewItem] = useState(null)
    const [previewLoading, setPreviewLoading] = useState(false)

    useEffect(() => {
        if (user?.role !== 'ADMIN') {
            toast.error('Access denied. Admin only.')
            navigate('/')
            return
        }
        loadInitialData()
    }, [user, navigate])

    const loadInitialData = async () => {
        setLoading(true)
        try {
            const [statsRes, collectionsRes] = await Promise.all([
                api.get('/vod/stats'),
                api.get('/vod/collections')
            ])
            setVodStats(statsRes.data.data)
            setCollections(collectionsRes.data.data.collections)
        } catch (error) {
            toast.error('Failed to load VOD data')
        } finally {
            setLoading(false)
        }
    }

    const loadCollectionStats = async () => {
        setLoadingCollectionStats(true)
        try {
            const response = await api.get('/vod/collections/stats')
            setCollectionStats(response.data.data.stats)
        } catch (error) {
            toast.error('Failed to load collection stats')
        } finally {
            setLoadingCollectionStats(false)
        }
    }

    const browseCollection = useCallback(async (collectionId, page = 1) => {
        if (!collectionId) return
        setBrowseLoading(true)
        try {
            const response = await api.get(`/vod/collections/${collectionId}/browse`, {
                params: { page, limit: 24 }
            })
            setBrowseItems(response.data.data.items)
            setBrowsePagination({
                page: response.data.data.page,
                pages: response.data.data.pages,
                total: response.data.data.total
            })
        } catch (error) {
            toast.error('Failed to browse collection')
        } finally {
            setBrowseLoading(false)
        }
    }, [])

    const handleSearch = async (e) => {
        e?.preventDefault()
        if (!searchQuery.trim()) return
        setSearchLoading(true)
        try {
            const response = await api.get('/vod/search', {
                params: { q: searchQuery, limit: 50 }
            })
            setSearchResults(response.data.data.items)
        } catch (error) {
            toast.error('Search failed')
        } finally {
            setSearchLoading(false)
        }
    }

    const previewMovie = async (identifier) => {
        setPreviewLoading(true)
        try {
            const response = await api.get(`/vod/preview/${identifier}`)
            setPreviewItem(response.data.data)
        } catch (error) {
            toast.error('Failed to load preview')
        } finally {
            setPreviewLoading(false)
        }
    }

    const toggleSelectItem = (sourceId) => {
        setSelectedItems(prev =>
            prev.includes(sourceId)
                ? prev.filter(id => id !== sourceId)
                : [...prev, sourceId]
        )
    }

    const selectAll = (items) => {
        const ids = items.map(i => i.sourceId)
        setSelectedItems(prev => {
            const allSelected = ids.every(id => prev.includes(id))
            if (allSelected) {
                return prev.filter(id => !ids.includes(id))
            }
            return [...new Set([...prev, ...ids])]
        })
    }

    const importSingle = async (identifier) => {
        setImporting(true)
        try {
            const response = await api.post('/vod/import/single', {
                identifier,
                ...importOptions
            })
            toast.success(`Imported: ${response.data.data.video.title}`)
            loadInitialData()
        } catch (error) {
            toast.error(error.response?.data?.message || 'Import failed')
        } finally {
            setImporting(false)
        }
    }

    const importSelected = async () => {
        if (selectedItems.length === 0) {
            toast.error('No items selected')
            return
        }
        setImporting(true)
        try {
            const response = await api.post('/vod/import/batch', {
                identifiers: selectedItems,
                ...importOptions
            })
            const { success, failed, skipped } = response.data.data
            toast.success(`Imported: ${success.length}, Failed: ${failed.length}, Skipped: ${skipped.length}`)
            setSelectedItems([])
            loadInitialData()
        } catch (error) {
            toast.error(error.response?.data?.message || 'Batch import failed')
        } finally {
            setImporting(false)
        }
    }

    const importFromCollection = async (collectionId) => {
        if (!collectionId) return
        setImporting(true)
        try {
            const response = await api.post('/vod/import/collection', {
                collection: collectionId,
                limit: 20,
                ...importOptions
            })
            toast.success(`Import job started: ${response.data.data.jobId}`)
            loadImportJobs()
        } catch (error) {
            toast.error(error.response?.data?.message || 'Collection import failed')
        } finally {
            setImporting(false)
        }
    }

    const loadImportJobs = async () => {
        try {
            const response = await api.get('/vod/import/jobs')
            setImportJobs(response.data.data.jobs)
        } catch (error) {
            console.error('Failed to load jobs')
        }
    }

    useEffect(() => {
        if (activeTab === 'collections') {
            loadCollectionStats()
        }
        if (activeTab === 'jobs') {
            loadImportJobs()
            const interval = setInterval(loadImportJobs, 5000)
            return () => clearInterval(interval)
        }
    }, [activeTab])

    useEffect(() => {
        if (selectedCollection) {
            browseCollection(selectedCollection, 1)
        }
    }, [selectedCollection, browseCollection])

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
            </div>
        )
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold text-white">VOD Manager</h1>
                <button
                    onClick={() => navigate('/admin')}
                    className="text-gray-400 hover:text-white"
                >
                    ← Back to Dashboard
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mb-8 border-b border-slate-700 overflow-x-auto">
                {['overview', 'collections', 'browse', 'search', 'jobs'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`pb-4 px-2 font-medium capitalize whitespace-nowrap ${activeTab === tab
                            ? 'text-primary-400 border-b-2 border-primary-400'
                            : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <div className="space-y-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <StatCard title="Total Videos" value={vodStats?.total || 0} icon="🎬" />
                        <StatCard title="With Subtitles" value={vodStats?.withSubtitles || 0} icon="💬" />
                        <StatCard title="Without Subtitles" value={vodStats?.withoutSubtitles || 0} icon="🔇" />
                        <StatCard title="Categories" value={vodStats?.categories?.length || 0} icon="📁" />
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-slate-800 rounded-lg p-6">
                            <h2 className="text-xl font-semibold text-white mb-4">Videos by Category</h2>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {vodStats?.categories?.map((cat) => (
                                    <div key={cat.name} className="flex justify-between items-center text-gray-300">
                                        <span>{cat.name}</span>
                                        <span className="text-primary-400 font-medium">{cat.count}</span>
                                    </div>
                                ))}
                                {(!vodStats?.categories || vodStats.categories.length === 0) && (
                                    <p className="text-gray-500">No categories yet</p>
                                )}
                            </div>
                        </div>

                        <div className="bg-slate-800 rounded-lg p-6">
                            <h2 className="text-xl font-semibold text-white mb-4">Recent Imports</h2>
                            <div className="space-y-3 max-h-64 overflow-y-auto">
                                {vodStats?.recentImports?.map((video) => (
                                    <div key={video.id} className="flex justify-between items-center text-gray-300">
                                        <span className="truncate max-w-[200px]">{video.title}</span>
                                        <span className="text-sm text-gray-500">
                                            {new Date(video.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                ))}
                                {(!vodStats?.recentImports || vodStats.recentImports.length === 0) && (
                                    <p className="text-gray-500">No recent imports</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Import Options */}
                    <div className="bg-slate-800 rounded-lg p-6">
                        <h2 className="text-xl font-semibold text-white mb-4">Import Options</h2>
                        <div className="flex flex-wrap gap-6">
                            <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={importOptions.skipExisting}
                                    onChange={(e) => setImportOptions(prev => ({
                                        ...prev,
                                        skipExisting: e.target.checked
                                    }))}
                                    className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-primary-500 focus:ring-primary-500"
                                />
                                Skip already imported
                            </label>
                            <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={importOptions.syncSubtitles}
                                    onChange={(e) => setImportOptions(prev => ({
                                        ...prev,
                                        syncSubtitles: e.target.checked
                                    }))}
                                    className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-primary-500 focus:ring-primary-500"
                                />
                                Sync subtitles (slower)
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {/* Collections Tab */}
            {activeTab === 'collections' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-semibold text-white">Archive.org Collections</h2>
                        <button
                            onClick={loadCollectionStats}
                            disabled={loadingCollectionStats}
                            className="text-primary-400 hover:text-primary-300 text-sm"
                        >
                            {loadingCollectionStats ? 'Loading...' : 'Refresh Stats'}
                        </button>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {(collectionStats.length > 0 ? collectionStats : collections).map((col) => (
                            <div key={col.key || col.id} className="bg-slate-800 rounded-lg p-4 hover:bg-slate-750 transition-colors">
                                <div className="flex items-start justify-between mb-2">
                                    <span className="text-3xl">{col.icon}</span>
                                    <span className="text-primary-400 font-bold text-lg">
                                        {col.count ? `~${col.count.toLocaleString()}` : '...'}
                                    </span>
                                </div>
                                <h3 className="text-white font-semibold">{col.name}</h3>
                                <p className="text-gray-400 text-sm mb-3">{col.description}</p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setSelectedCollection(col.key || col.id)
                                            setActiveTab('browse')
                                        }}
                                        className="text-sm text-primary-400 hover:text-primary-300"
                                    >
                                        Browse
                                    </button>
                                    <button
                                        onClick={() => importFromCollection(col.key || col.id)}
                                        disabled={importing}
                                        className="text-sm text-green-400 hover:text-green-300 disabled:opacity-50"
                                    >
                                        Import Top 20
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Browse Tab */}
            {activeTab === 'browse' && (
                <div className="space-y-6">
                    <div className="flex flex-wrap gap-4 items-center">
                        <select
                            value={selectedCollection}
                            onChange={(e) => setSelectedCollection(e.target.value)}
                            className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
                        >
                            <option value="">Select Collection</option>
                            {collections.map((col) => (
                                <option key={col.id} value={col.id}>{col.icon} {col.name}</option>
                            ))}
                        </select>

                        {selectedItems.length > 0 && (
                            <button
                                onClick={importSelected}
                                disabled={importing}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg"
                            >
                                {importing ? 'Importing...' : `Import Selected (${selectedItems.length})`}
                            </button>
                        )}

                        {browseItems.length > 0 && (
                            <button
                                onClick={() => selectAll(browseItems)}
                                className="text-sm text-primary-400 hover:text-primary-300"
                            >
                                Toggle All
                            </button>
                        )}
                    </div>

                    {browseLoading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
                        </div>
                    ) : browseItems.length > 0 ? (
                        <>
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {browseItems.map((item) => (
                                    <MovieCard
                                        key={item.sourceId}
                                        item={item}
                                        selected={selectedItems.includes(item.sourceId)}
                                        onToggle={() => toggleSelectItem(item.sourceId)}
                                        onPreview={() => previewMovie(item.sourceId)}
                                        onImport={() => importSingle(item.sourceId)}
                                        importing={importing}
                                    />
                                ))}
                            </div>

                            {/* Pagination */}
                            {browsePagination.pages > 1 && (
                                <div className="flex justify-center gap-2">
                                    <button
                                        onClick={() => browseCollection(selectedCollection, browsePagination.page - 1)}
                                        disabled={browsePagination.page <= 1}
                                        className="px-3 py-1 bg-slate-700 text-white rounded disabled:opacity-50"
                                    >
                                        Previous
                                    </button>
                                    <span className="px-3 py-1 text-gray-400">
                                        Page {browsePagination.page} of {browsePagination.pages}
                                    </span>
                                    <button
                                        onClick={() => browseCollection(selectedCollection, browsePagination.page + 1)}
                                        disabled={browsePagination.page >= browsePagination.pages}
                                        className="px-3 py-1 bg-slate-700 text-white rounded disabled:opacity-50"
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-12 text-gray-500">
                            Select a collection to browse
                        </div>
                    )}
                </div>
            )}

            {/* Search Tab */}
            {activeTab === 'search' && (
                <div className="space-y-6">
                    <form onSubmit={handleSearch} className="flex gap-4">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search movies on Archive.org..."
                            className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary-500"
                        />
                        <button
                            type="submit"
                            disabled={searchLoading}
                            className="px-6 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg"
                        >
                            {searchLoading ? 'Searching...' : 'Search'}
                        </button>
                    </form>

                    {selectedItems.length > 0 && (
                        <button
                            onClick={importSelected}
                            disabled={importing}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg"
                        >
                            {importing ? 'Importing...' : `Import Selected (${selectedItems.length})`}
                        </button>
                    )}

                    {searchLoading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
                        </div>
                    ) : searchResults.length > 0 ? (
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {searchResults.map((item) => (
                                <MovieCard
                                    key={item.sourceId}
                                    item={item}
                                    selected={selectedItems.includes(item.sourceId)}
                                    onToggle={() => toggleSelectItem(item.sourceId)}
                                    onPreview={() => previewMovie(item.sourceId)}
                                    onImport={() => importSingle(item.sourceId)}
                                    importing={importing}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-500">
                            Search Archive.org for public domain movies
                        </div>
                    )}
                </div>
            )}

            {/* Jobs Tab */}
            {activeTab === 'jobs' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-semibold text-white">Import Jobs</h2>
                        <button
                            onClick={loadImportJobs}
                            className="text-primary-400 hover:text-primary-300 text-sm"
                        >
                            Refresh
                        </button>
                    </div>

                    {importJobs.length > 0 ? (
                        <div className="space-y-4">
                            {importJobs.map((job) => (
                                <div key={job.id} className="bg-slate-800 rounded-lg p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <span className="text-white font-medium">Collection: {job.collection}</span>
                                            <span className={`ml-3 px-2 py-1 text-xs rounded ${job.status === 'completed' ? 'bg-green-600' :
                                                    job.status === 'failed' ? 'bg-red-600' :
                                                        'bg-yellow-600'
                                                } text-white`}>
                                                {job.status}
                                            </span>
                                        </div>
                                        <span className="text-sm text-gray-500">
                                            {new Date(job.startedAt).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex gap-6 text-sm text-gray-400">
                                        <span>Progress: {job.progress}%</span>
                                        <span>Imported: {job.imported}</span>
                                        <span>Skipped: {job.skipped}</span>
                                        <span>Failed: {job.failed}</span>
                                    </div>
                                    {job.status === 'running' && (
                                        <div className="mt-2 bg-slate-700 rounded-full h-2">
                                            <div
                                                className="bg-primary-500 h-2 rounded-full transition-all"
                                                style={{ width: `${job.progress}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-500">
                            No active import jobs
                        </div>
                    )}
                </div>
            )}

            {/* Preview Modal */}
            {previewItem && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <h2 className="text-xl font-bold text-white">{previewItem.title}</h2>
                                <button
                                    onClick={() => setPreviewItem(null)}
                                    className="text-gray-400 hover:text-white text-2xl"
                                >
                                    ×
                                </button>
                            </div>

                            {previewItem.thumbnail && (
                                <img
                                    src={previewItem.thumbnail}
                                    alt={previewItem.title}
                                    className="w-full h-48 object-cover rounded-lg mb-4"
                                />
                            )}

                            <div className="space-y-3 text-gray-300">
                                {previewItem.year && (
                                    <p><span className="text-gray-500">Year:</span> {previewItem.year}</p>
                                )}
                                {previewItem.creator && (
                                    <p><span className="text-gray-500">Creator:</span> {previewItem.creator}</p>
                                )}
                                {previewItem.duration && (
                                    <p><span className="text-gray-500">Duration:</span> {Math.round(previewItem.duration / 60)} min</p>
                                )}
                                {previewItem.language && (
                                    <p><span className="text-gray-500">Language:</span> {previewItem.language}</p>
                                )}
                                {previewItem.description && (
                                    <p className="text-sm">{previewItem.description.substring(0, 500)}...</p>
                                )}

                                {previewItem.alreadyImported && (
                                    <div className="bg-yellow-900/50 border border-yellow-600 rounded p-3 text-yellow-300">
                                        This movie is already in your library
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 mt-6">
                                {previewItem.videoUrl && (
                                    <a
                                        href={previewItem.videoUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
                                    >
                                        Preview Video
                                    </a>
                                )}
                                <button
                                    onClick={() => {
                                        importSingle(previewItem.sourceId)
                                        setPreviewItem(null)
                                    }}
                                    disabled={importing || previewItem.alreadyImported}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg"
                                >
                                    {previewItem.alreadyImported ? 'Already Imported' : 'Import'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

const StatCard = ({ title, value, icon }) => (
    <div className="bg-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between">
            <div>
                <p className="text-gray-400 text-sm">{title}</p>
                <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
            </div>
            <span className="text-3xl">{icon}</span>
        </div>
    </div>
)

const MovieCard = ({ item, selected, onToggle, onPreview, onImport, importing }) => (
    <div className={`bg-slate-800 rounded-lg overflow-hidden border-2 transition-colors ${selected ? 'border-primary-500' : 'border-transparent'
        }`}>
        <div
            className="h-32 bg-slate-700 flex items-center justify-center cursor-pointer"
            onClick={onPreview}
        >
            <span className="text-4xl">🎬</span>
        </div>
        <div className="p-3">
            <h3 className="text-white font-medium text-sm truncate" title={item.title}>
                {item.title}
            </h3>
            <div className="flex items-center justify-between text-xs text-gray-400 mt-1">
                <span>{item.year || 'N/A'}</span>
                {item.downloads && <span>{item.downloads.toLocaleString()} downloads</span>}
            </div>
            <div className="flex gap-2 mt-3">
                <button
                    onClick={onToggle}
                    className={`flex-1 py-1 text-xs rounded ${selected
                            ? 'bg-primary-600 text-white'
                            : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                        }`}
                >
                    {selected ? 'Selected' : 'Select'}
                </button>
                <button
                    onClick={onImport}
                    disabled={importing}
                    className="flex-1 py-1 text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded"
                >
                    Import
                </button>
            </div>
        </div>
    </div>
)

export default VodManager
