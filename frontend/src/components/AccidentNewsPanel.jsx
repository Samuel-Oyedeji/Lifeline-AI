import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const AUTO_INTERVAL_MS = 8000

function timeAgo(iso) {
  if (!iso || iso === '') return ''
  const date = new Date(iso)
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) {
    const t = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return `Today ${t}`
  }
  return `${Math.floor(hrs / 24)}d ago`
}

export default function AccidentNewsPanel() {
  const [articles, setArticles] = useState([])
  const [live, setLive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState(1)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    fetch('/api/news')
      .then((r) => r.json())
      .then((d) => {
        setArticles(d.articles ?? [])
        setLive(d.live ?? false)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const go = useCallback(
    (step) => {
      if (!articles.length) return
      setDir(step)
      setIndex((i) => (i + step + articles.length) % articles.length)
    },
    [articles.length],
  )

  // Auto-rotate
  useEffect(() => {
    if (paused || articles.length < 2) return
    timerRef.current = setInterval(() => go(1), AUTO_INTERVAL_MS)
    return () => clearInterval(timerRef.current)
  }, [paused, articles.length, go])

  const article = articles[index] ?? null

  return (
    <div
      className="glass card"
      style={{ padding: '20px 22px 18px', display: 'flex', flexDirection: 'column', gap: 0 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span
          className="dot"
          style={{
            background: live ? 'var(--critical)' : 'var(--text-faint)',
            boxShadow: live ? '0 0 8px var(--critical)' : 'none',
            animation: live ? 'pulseRing 2s infinite' : 'none',
            width: 8,
            height: 8,
            borderRadius: '50%',
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
        <span className="label" style={{ margin: 0, fontSize: 11, letterSpacing: '0.1em' }}>
          {live ? 'LIVE ACCIDENT NEWS' : 'ACCIDENT NEWS  ·  SAMPLE DATA'}
        </span>
        {!live && (
          <span
            title="Set GNEWS_API_KEY on the server to enable live news"
            style={{
              marginLeft: 'auto',
              fontSize: 10,
              color: 'var(--text-faint)',
              cursor: 'help',
              borderBottom: '1px dashed var(--text-faint)',
            }}
          >
            demo mode
          </span>
        )}
      </div>

      {/* Article body */}
      <div style={{ flex: 1, minHeight: 90, position: 'relative', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-dim)', fontSize: 13 }}>
            <span className="spinner" style={{ width: 14, height: 14 }} />
            Loading news…
          </div>
        ) : article ? (
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div
              key={index}
              custom={dir}
              variants={{
                enter: (d) => ({ x: d > 0 ? 40 : -40, opacity: 0 }),
                center: { x: 0, opacity: 1 },
                exit: (d) => ({ x: d > 0 ? -40 : 40, opacity: 0 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: 'easeOut' }}
            >
              {article.url && article.url !== '#' ? (
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <ArticleContent article={article} />
                </a>
              ) : (
                <ArticleContent article={article} />
              )}
            </motion.div>
          </AnimatePresence>
        ) : (
          <p style={{ color: 'var(--text-faint)', fontSize: 13 }}>No articles available.</p>
        )}
      </div>

      {/* Navigation */}
      {articles.length > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 14,
            paddingTop: 12,
            borderTop: '1px solid var(--glass-border)',
          }}
        >
          <NavArrow dir="left" onClick={() => go(-1)} />

          {/* Dot indicators */}
          <div style={{ display: 'flex', gap: 5 }}>
            {articles.map((_, i) => (
              <button
                key={i}
                onClick={() => { setDir(i > index ? 1 : -1); setIndex(i) }}
                style={{
                  width: i === index ? 16 : 6,
                  height: 6,
                  borderRadius: 3,
                  border: 'none',
                  background: i === index ? 'var(--primary)' : 'var(--glass-border-strong)',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'width 0.22s ease, background 0.22s ease',
                }}
              />
            ))}
          </div>

          <NavArrow dir="right" onClick={() => go(1)} />
        </div>
      )}
    </div>
  )
}

function ArticleContent({ article }) {
  return (
    <div>
      <p
        style={{
          fontWeight: 600,
          fontSize: 14.5,
          lineHeight: 1.45,
          color: 'var(--text)',
          margin: '0 0 8px',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {article.title}
      </p>
      {article.description && (
        <p
          style={{
            fontSize: 13,
            color: 'var(--text-dim)',
            lineHeight: 1.55,
            margin: '0 0 10px',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {article.description}
        </p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--text-faint)' }}>
        {article.source && (
          <span style={{ fontWeight: 600, color: 'var(--secondary)' }}>{article.source}</span>
        )}
        {article.source && article.publishedAt && <span>·</span>}
        {article.publishedAt && <span>{timeAgo(article.publishedAt)}</span>}
        {article.url && article.url !== '#' && (
          <>
            <span style={{ marginLeft: 'auto' }}>↗</span>
          </>
        )}
      </div>
    </div>
  )
}

function NavArrow({ dir, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        border: '1px solid var(--glass-border)',
        background: 'rgba(255,255,255,0.04)',
        color: 'var(--text-dim)',
        cursor: 'pointer',
        display: 'grid',
        placeItems: 'center',
        fontSize: 14,
        transition: 'background 0.15s, color 0.15s',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
        e.currentTarget.style.color = 'var(--text)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
        e.currentTarget.style.color = 'var(--text-dim)'
      }}
    >
      {dir === 'left' ? '‹' : '›'}
    </button>
  )
}
