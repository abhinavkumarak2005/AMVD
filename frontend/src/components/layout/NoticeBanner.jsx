import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useNoticeStore } from '../../store'

export default function NoticeBanner() {
  const { notices, dismissed, dismiss } = useNoticeStore()
  const active = notices.filter((n) => !dismissed.includes(n.id) && n.type === 'banner')

  return (
    <AnimatePresence>
      {active.map((notice) => (
        <motion.div key={notice.id}
          initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="notice-banner"
        >
          <span className="font-semibold">{notice.title}:</span> <span>{notice.body}</span>
          <button onClick={() => dismiss(notice.id)}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"
          >
            <X size={10} />
          </button>
        </motion.div>
      ))}
    </AnimatePresence>
  )
}
