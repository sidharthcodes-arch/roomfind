'use client'

import { useState } from 'react'
import { X, Copy, Check, MessageSquare, Mail, Share2 } from 'lucide-react'

export default function ShareModal({ isOpen, onClose, listing }) {
  const [copied, setCopied] = useState(false)

  if (!isOpen || !listing) return null

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/listings/${listing.id}`
    : ''

  const shareTitle = listing.title || 'RoomFind Listing'
  const shareText = `Check out "${shareTitle}" on RoomFind - ₹${Number(listing.price || 0).toLocaleString('en-IN')}/mo in ${listing.area || ''}, ${listing.city || ''}!`

  // Social Share URLs
  const encodedUrl = encodeURIComponent(shareUrl)
  const encodedText = encodeURIComponent(`${shareText}\n${shareUrl}`)
  const encodedSummary = encodeURIComponent(shareText)

  const shareLinks = [
    {
      name: 'WhatsApp',
      href: `https://api.whatsapp.com/send?text=${encodedText}`,
      bg: 'bg-emerald-500 hover:bg-emerald-600',
      icon: (
        <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      )
    },
    {
      name: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      bg: 'bg-blue-600 hover:bg-blue-700',
      icon: (
        <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      )
    },
    {
      name: 'X (Twitter)',
      href: `https://twitter.com/intent/tweet?text=${encodedSummary}&url=${encodedUrl}`,
      bg: 'bg-slate-900 hover:bg-black',
      icon: (
        <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      )
    },
    {
      name: 'Telegram',
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedSummary}`,
      bg: 'bg-sky-500 hover:bg-sky-600',
      icon: (
        <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
          <path d="M9.78 18.65l.28-4.28 7.77-7.02c.34-.31-.07-.48-.52-.19l-9.6 6.04-4.15-1.3c-.9-.28-.92-.9.19-1.33L19.92 4.35c.75-.28 1.41.17 1.17 1.29l-2.75 12.98c-.2.92-.75 1.15-1.52.72l-4.21-3.1-2.03 1.96c-.22.23-.42.42-.86.42z"/>
        </svg>
      )
    },
    {
      name: 'Email',
      href: `mailto:?subject=${encodeURIComponent(`RoomFind: ${shareTitle}`)}&body=${encodedText}`,
      bg: 'bg-slate-700 hover:bg-slate-800',
      icon: <Mail className="w-5 h-5 text-white" />
    }
  ]

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl)
      } else {
        const textArea = document.createElement("textarea")
        textArea.value = shareUrl
        textArea.style.position = "fixed"
        textArea.style.left = "-999999px"
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand("copy")
        textArea.remove()
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch (_) {}
  }

  return (
    <div 
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4 pb-[60px] sm:pb-4 bg-black/60 backdrop-blur-sm animate-fade-in" 
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl space-y-5 animate-slide-up max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/[0.08] pb-3.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-[16px] leading-tight">Share Listing</h3>
              <p className="text-[12px] text-slate-500 truncate max-w-[220px] sm:max-w-[260px]">{shareTitle}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Platform Share Grid */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Share to Social</p>
          <div className="grid grid-cols-5 gap-2.5 text-center">
            {shareLinks.map((platform) => (
              <a
                key={platform.name}
                href={platform.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1.5 group"
              >
                <div className={`w-12 h-12 rounded-2xl ${platform.bg} flex items-center justify-center shadow-md transition-transform group-hover:scale-105 active:scale-95`}>
                  {platform.icon}
                </div>
                <span className="text-[11px] font-medium text-slate-600 group-hover:text-slate-900 truncate w-full">
                  {platform.name}
                </span>
              </a>
            ))}
          </div>
        </div>

        {/* Copy Link Section */}
        <div className="space-y-2 pt-1 border-t border-black/[0.06]">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Or Copy Link</p>
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-black/[0.08]">
            <input 
              type="text" 
              readOnly 
              value={shareUrl} 
              className="flex-1 bg-transparent px-2 text-xs font-mono text-slate-700 outline-none truncate"
            />
            <button 
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                copied 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-brand text-white hover:bg-brand-dark'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
