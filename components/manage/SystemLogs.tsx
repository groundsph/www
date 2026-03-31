"use client"

import { useState, useEffect, useCallback } from "react"
import { format } from "date-fns"
import {
    Activity,
    Download,
    ChevronDown,
    ChevronUp,
    Search,
    Filter,
    BarChart3,
    FileText,
} from "lucide-react"
import {
    getSystemLogs,
    getSystemLogStats,
    exportSystemLogsCSV,
    type SystemLog,
    type SystemLogFilters,
} from "@/app/api/actions/system-logs"
import { UserAvatar } from "@/components/ui/UserAvatar"

type TabType = "logs" | "analytics"

const ACTION_COLORS: Record<string, string> = {
    create: "text-green-600 bg-green-500/20",
    update: "text-blue-600 bg-blue-500/20",
    delete: "text-red-600 bg-red-500/20",
    approve: "text-emerald-600 bg-emerald-500/20",
    reject: "text-orange-600 bg-orange-500/20",
    role_change: "text-purple-600 bg-purple-500/20",
}

const ACTION_LABELS: Record<string, string> = {
    create: "Created",
    update: "Updated",
    delete: "Deleted",
    approve: "Approved",
    reject: "Rejected",
    role_change: "Role Changed",
}

const ENTITY_ICONS: Record<string, string> = {
    cafe: "☕",
    blog: "📝",
    event: "📅",
    user: "👤",
    featured: "⭐",
    review: "💬",
}

export default function SystemLogs() {
    const [activeTab, setActiveTab] = useState<TabType>("logs")
    const [logs, setLogs] = useState<SystemLog[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(true)
    const [expandedLog, setExpandedLog] = useState<string | null>(null)

    // Filters
    const [actionFilter, setActionFilter] = useState<string>("")
    const [entityFilter, setEntityFilter] = useState<string>("")
    const [searchQuery, setSearchQuery] = useState("")
    const [startDate, setStartDate] = useState<string>("")
    const [endDate, setEndDate] = useState<string>("")
    const [showFilters, setShowFilters] = useState(false)

    // Analytics
    const [stats, setStats] = useState<{
        totalLogs: number
        logsByAction: { action: string; count: number }[]
        logsByEntityType: { entityType: string; count: number }[]
        logsByUser: { userId: string; username: string | null; count: number }[]
        dailyTrend: { date: string; count: number }[]
    } | null>(null)

    // Export
    const [exporting, setExporting] = useState(false)

    const loadLogs = useCallback(async () => {
        setLoading(true)
        const activeFilters: SystemLogFilters = {}
        if (actionFilter) activeFilters.action = actionFilter
        if (entityFilter) activeFilters.entityType = entityFilter
        if (startDate) activeFilters.startDate = new Date(startDate)
        if (endDate) activeFilters.endDate = new Date(endDate)
        if (searchQuery) activeFilters.search = searchQuery

        const result = await getSystemLogs(activeFilters, page, 50)
        setLogs(result.logs)
        setTotal(result.total)
        setLoading(false)
    }, [actionFilter, entityFilter, startDate, endDate, searchQuery, page])

    const loadStats = useCallback(async () => {
        const result = await getSystemLogStats(30)
        setStats(result)
    }, [])

    useEffect(() => {
        // Use requestAnimationFrame to avoid synchronous setState in effect
        const timer = requestAnimationFrame(() => {
            if (activeTab === "logs") {
                loadLogs()
            } else {
                loadStats()
            }
        })
        return () => cancelAnimationFrame(timer)
    }, [activeTab, loadLogs, loadStats])

    const handleExport = async () => {
        setExporting(true)
        try {
            const csv = await exportSystemLogsCSV({
                action: actionFilter || undefined,
                entityType: entityFilter || undefined,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                search: searchQuery || undefined,
            })
            if (!csv) {
                alert("Export failed: Not authorized")
                return
            }

            // Download CSV
            const blob = new Blob([csv], { type: "text/csv" })
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `system-logs-${format(new Date(), "yyyy-MM-dd")}.csv`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
        } catch {
            alert("Export failed")
        }
        setExporting(false)
    }

    const totalPages = Math.ceil(total / 50)

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-text">
                        System Logs
                    </h1>
                    <p className="text-text/60 mt-1">
                        Track all management actions and changes
                    </p>
                </div>
                <button
                    onClick={handleExport}
                    disabled={exporting}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition disabled:opacity-50"
                >
                    <Download className="w-4 h-4" />
                    {exporting ? "Exporting..." : "Export CSV"}
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                <button
                    onClick={() => setActiveTab("logs")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition text-sm font-medium ${
                        activeTab === "logs"
                            ? "bg-primary text-white"
                            : "bg-tertiary/30 text-text/70 hover:bg-tertiary"
                    }`}
                >
                    <Activity className="w-4 h-4" />
                    Logs ({total})
                </button>
                <button
                    onClick={() => setActiveTab("analytics")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition text-sm font-medium ${
                        activeTab === "analytics"
                            ? "bg-primary text-white"
                            : "bg-tertiary/30 text-text/70 hover:bg-tertiary"
                    }`}
                >
                    <BarChart3 className="w-4 h-4" />
                    Analytics
                </button>
            </div>

            {/* Logs Tab */}
            {activeTab === "logs" && (
                <>
                    {/* Filters */}
                    <div className="bg-background rounded-xl border border-tertiary/50 p-4">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="flex items-center gap-2 text-sm font-medium text-text/70 hover:text-text transition"
                        >
                            <Filter className="w-4 h-4" />
                            Filters
                            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>

                        {showFilters && (
                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-text/60 mb-1">Action</label>
                                    <select
                                        value={actionFilter}
                                        onChange={(e) => setActionFilter(e.target.value)}
                                        className="w-full px-3 py-2 bg-tertiary/20 border border-tertiary/50 rounded-lg text-sm"
                                    >
                                        <option value="">All actions</option>
                                        <option value="create">Create</option>
                                        <option value="update">Update</option>
                                        <option value="delete">Delete</option>
                                        <option value="approve">Approve</option>
                                        <option value="reject">Reject</option>
                                        <option value="role_change">Role Change</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-text/60 mb-1">Entity Type</label>
                                    <select
                                        value={entityFilter}
                                        onChange={(e) => setEntityFilter(e.target.value)}
                                        className="w-full px-3 py-2 bg-tertiary/20 border border-tertiary/50 rounded-lg text-sm"
                                    >
                                        <option value="">All entities</option>
                                        <option value="cafe">Cafe</option>
                                        <option value="blog">Blog</option>
                                        <option value="event">Event</option>
                                        <option value="user">User</option>
                                        <option value="featured">Featured</option>
                                        <option value="review">Review</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-text/60 mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-tertiary/20 border border-tertiary/50 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-text/60 mb-1">End Date</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-tertiary/20 border border-tertiary/50 rounded-lg text-sm"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Search */}
                        <div className="mt-4 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by entity ID..."
                                className="w-full pl-10 pr-4 py-2 bg-tertiary/20 border border-tertiary/50 rounded-lg text-sm"
                            />
                        </div>

                        {/* Apply Filters Button */}
                        <button
                            onClick={() => { setPage(1); loadLogs(); }}
                            className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition"
                        >
                            Apply Filters
                        </button>
                    </div>

                    {/* Logs List */}
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-16 bg-background rounded-xl border border-tertiary/50">
                            <FileText className="w-12 h-12 mx-auto opacity-30 mb-4" />
                            <p className="text-text/60">No logs found</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {logs.map((log) => {
                                const isExpanded = expandedLog === log.id
                                const actionColor = ACTION_COLORS[log.action] || "text-gray-600 bg-gray-500/20"
                                const actionLabel = ACTION_LABELS[log.action] || log.action
                                const entityIcon = ENTITY_ICONS[log.entityType] || "📄"

                                return (
                                    <div
                                        key={log.id}
                                        className="bg-background border border-tertiary/50 rounded-xl overflow-hidden"
                                    >
                                        <div className="p-4 flex items-start gap-4">
                                            {/* Icon */}
                                            <div className="text-2xl">{entityIcon}</div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${actionColor}`}>
                                                        {actionLabel}
                                                    </span>
                                                    <span className="font-medium capitalize">{log.entityType}</span>
                                                    <span className="text-text/40 text-xs font-mono">
                                                        {log.entityId.substring(0, 8)}...
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2 mt-2 text-sm text-text/60">
                                                    {log.user && (
                                                        <>
                                                            <UserAvatar
                                                                src={log.user.avatarUrl}
                                                                alt={log.user.displayName || log.user.username || "User"}
                                                                size={20}
                                                            />
                                                            <span>@{log.user.username}</span>
                                                            <span className="text-text/30">•</span>
                                                        </>
                                                    )}
                                                    <span>{log.createdAt ? format(new Date(log.createdAt), "PPp") : "Unknown date"}</span>
                                                </div>
                                            </div>

                                            {/* Expand Button */}
                                            <button
                                                onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                                                className="p-2 hover:bg-tertiary/30 rounded-lg transition"
                                            >
                                                {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                            </button>
                                        </div>

                                        {/* Expanded Details */}
                                        {isExpanded && (
                                            <div className="border-t border-tertiary/50 p-4 bg-tertiary/10">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {log.beforeValue && (
                                                        <div>
                                                            <h4 className="text-xs font-medium text-text/40 uppercase mb-2">Before</h4>
                                                            <pre className="text-xs bg-background p-3 rounded-lg overflow-auto max-h-48">
                                                                {JSON.stringify(log.beforeValue as Record<string, unknown>, null, 2)}
                                                            </pre>
                                                        </div>
                                                    )}
                                                    {log.afterValue && (
                                                        <div>
                                                            <h4 className="text-xs font-medium text-text/40 uppercase mb-2">After</h4>
                                                            <pre className="text-xs bg-background p-3 rounded-lg overflow-auto max-h-48">
                                                                {JSON.stringify(log.afterValue as Record<string, unknown>, null, 2)}
                                                            </pre>
                                                        </div>
                                                    )}
                                                    {log.userAgent && (
                                                        <div className="md:col-span-2">
                                                            <h4 className="text-xs font-medium text-text/40 uppercase mb-2">User Agent</h4>
                                                            <p className="text-xs text-text/60">{log.userAgent}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1.5 bg-tertiary/30 rounded-lg text-sm disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <span className="text-sm text-text/60">
                                Page {page} of {totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="px-3 py-1.5 bg-tertiary/30 rounded-lg text-sm disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* Analytics Tab */}
            {activeTab === "analytics" && stats && (
                <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-background rounded-xl p-4 border border-tertiary/50">
                            <div className="text-3xl font-bold">{stats.totalLogs.toLocaleString()}</div>
                            <div className="text-text/60 text-sm">Total Logs (30 days)</div>
                        </div>
                        <div className="bg-background rounded-xl p-4 border border-tertiary/50">
                            <div className="text-3xl font-bold">{stats.logsByAction.length}</div>
                            <div className="text-text/60 text-sm">Action Types</div>
                        </div>
                        <div className="bg-background rounded-xl p-4 border border-tertiary/50">
                            <div className="text-3xl font-bold">{stats.logsByUser.length}</div>
                            <div className="text-text/60 text-sm">Active Team Members</div>
                        </div>
                    </div>

                    {/* By Action */}
                    <div className="bg-background rounded-xl p-4 border border-tertiary/50">
                        <h3 className="font-semibold mb-4">Actions by Type</h3>
                        <div className="space-y-2">
                            {stats.logsByAction.map((item) => (
                                <div key={item.action} className="flex items-center justify-between">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[item.action] || "bg-gray-500/20"}`}>
                                        {ACTION_LABELS[item.action] || item.action}
                                    </span>
                                    <span className="text-text/60">{item.count.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* By Entity */}
                    <div className="bg-background rounded-xl p-4 border border-tertiary/50">
                        <h3 className="font-semibold mb-4">Actions by Entity</h3>
                        <div className="space-y-2">
                            {stats.logsByEntityType.map((item) => (
                                <div key={item.entityType} className="flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <span>{ENTITY_ICONS[item.entityType] || "📄"}</span>
                                        <span className="capitalize">{item.entityType}</span>
                                    </span>
                                    <span className="text-text/60">{item.count.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Top Users */}
                    <div className="bg-background rounded-xl p-4 border border-tertiary/50">
                        <h3 className="font-semibold mb-4">Most Active Team Members</h3>
                        <div className="space-y-2">
                            {stats.logsByUser.map((item, index) => (
                                <div key={item.userId} className="flex items-center justify-between">
                                    <span className="text-text/60">#{index + 1} @{item.username || "unknown"}</span>
                                    <span className="text-text/60">{item.count.toLocaleString()} actions</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Daily Trend */}
                    <div className="bg-background rounded-xl p-4 border border-tertiary/50">
                        <h3 className="font-semibold mb-4">Daily Activity (Last 30 Days)</h3>
                        <div className="h-32 flex items-end gap-1">
                            {stats.dailyTrend.slice(-30).map((item, i) => {
                                const max = Math.max(...stats.dailyTrend.map(d => d.count))
                                const height = max > 0 ? (item.count / max) * 100 : 0
                                return (
                                    <div
                                        key={i}
                                        className="flex-1 bg-primary/30 hover:bg-primary/50 rounded-t transition cursor-pointer"
                                        style={{ height: `${Math.max(height, 2)}%` }}
                                        title={`${item.date}: ${item.count} actions`}
                                    />
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
