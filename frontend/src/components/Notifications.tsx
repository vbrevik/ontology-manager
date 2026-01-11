import { useEffect, useState, useRef } from 'react'
import { Bell, Check, X } from 'lucide-react'
import { getUserInfo } from '@/features/auth/lib/auth'

interface Notification {
  id: number
  message: string
  read: number
  created_at: string
}

export default function Notifications() {
  const [count, setCount] = useState(0)
  const [items, setItems] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [toasts, setToasts] = useState<Notification[]>([])
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    async function load() {
      const user = await getUserInfo()
      if (!user) return

      try {
        const res = await fetch(`/api/auth/notifications?user_id=${user.id}`, { credentials: 'include' })
        if (res.ok) {
          const json = await res.json()
          const notifications = json.notifications || []
          setItems(notifications)
          setCount(notifications.filter((n: Notification) => n.read === 0).length)
        }
      } catch (e) {
        console.error('Error loading notifications', e)
      }

      // Setup SSE
      if (!eventSourceRef.current) {
        eventSourceRef.current = new EventSource('/api/auth/notifications/stream')
        eventSourceRef.current.onmessage = (event) => {
          try {
            const newNotif = JSON.parse(event.data)
            setItems(prev => [newNotif, ...prev])
            setCount(c => c + 1)

            // Add to toasts
            const toastId = newNotif.id
            setToasts(prev => [...prev, newNotif])
            setTimeout(() => {
              setToasts(prev => prev.filter(t => t.id !== toastId))
            }, 5000)
          } catch (e) {
            console.error('Error parsing SSE event', e)
          }
        }
      }
    }

    load()

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [])

  async function markRead(id: number) {
    const user = await getUserInfo()
    if (!user) return
    const res = await fetch(`/api/auth/notifications/${id}/read?user_id=${user.id}`, { method: 'POST', credentials: 'include' })
    if (res.ok) {
      setItems((it) => it.map((i) => (i.id === id ? { ...i, read: 1 } : i)))
      setCount((c) => Math.max(0, c - 1))
    }
  }

  async function markAllRead() {
    const user = await getUserInfo()
    if (!user) return
    const res = await fetch('/api/auth/notifications/read-all', { method: 'POST', credentials: 'include' })
    if (res.ok) {
      setItems((it) => it.map((i) => ({ ...i, read: 1 })))
      setCount(0)
    }
  }

  return (
    <>
      {/* Toast Overlay */}
      <div className="fixed top-16 right-4 z-[100] flex flex-col gap-2">
        {toasts.map(toast => (
          <div key={toast.id} className="bg-slate-800 border border-primary/20 shadow-2xl rounded-lg p-4 w-80 animate-in slide-in-from-right duration-300 flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Bell size={14} className="text-primary" />
                <span className="font-semibold text-xs uppercase tracking-wider text-slate-400">New Notification</span>
              </div>
              <div className="text-sm text-slate-100">{toast.message}</div>
            </div>
            <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} className="text-slate-500 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className={`p-2 rounded-md hover:bg-slate-800 relative transition-colors ${open ? 'bg-slate-800 text-primary' : 'text-slate-400'}`}
        >
          <Bell size={20} />
          {count > 0 && (
            <span className="absolute top-1.5 right-1.5 bg-primary text-primary-foreground rounded-full text-[9px] w-4 h-4 flex items-center justify-center font-bold border-2 border-slate-900">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <h3 className="text-sm font-bold text-white">Notifications</h3>
              {count > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors font-medium"
                >
                  <Check size={14} />
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              {items.length === 0 && (
                <div className="py-12 px-4 text-center text-slate-500 flex flex-col items-center gap-3">
                  <div className="bg-slate-800 p-3 rounded-full">
                    <Bell size={24} className="opacity-20" />
                  </div>
                  <div className="text-xs font-medium">You're all caught up!</div>
                </div>
              )}
              {items.map((n) => (
                <div
                  key={n.id}
                  className={`p-4 border-b border-slate-800/50 last:border-b-0 flex justify-between items-start group transition-all duration-200 ${n.read === 0 ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-slate-800/50'}`}
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <div className={`text-sm leading-snug mb-1.5 ${n.read === 0 ? 'text-slate-100 font-medium' : 'text-slate-400'}`}>
                      {n.message}
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                      <div className={`w-1 h-1 rounded-full ${n.read === 0 ? 'bg-primary' : 'bg-slate-700'}`} />
                      {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(n.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  {n.read === 0 && (
                    <button
                      onClick={() => markRead(n.id)}
                      className="p-1.5 text-slate-500 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                      title="Mark as read"
                    >
                      <Check size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-slate-800 bg-slate-900/80 text-center">
              <button className="text-xs text-slate-400 hover:text-white transition-colors font-medium">
                View all activity
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}


