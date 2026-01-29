import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'

const WEB_NATIVE_FILE_EXTS = new Set(['mp4', 'webm', 'ogv'])
const IPTV_ONLY_TYPES = new Set(['DASH', 'MPEGTS', 'RTMP_INGEST'])
const EXTERNAL_HOSTS = ['dailymotion.com', 'vimeo.com', 'twitch.tv', 'facebook.com', 'rumble.com', 'odysee.com']

const extractFileExt = (url) => {
  if (!url) return null
  const match = url.toLowerCase().match(/\.([a-z0-9]{2,8})(?:[?#]|$)/)
  return match ? match[1] : null
}

const detectStreamType = (url) => {
  if (!url) return 'UNKNOWN'
  const lowerUrl = url.toLowerCase()
  if (lowerUrl.startsWith('rtmp://') || lowerUrl.startsWith('rtmps://')) return 'RTMP_INGEST'

  const ext = extractFileExt(lowerUrl)
  if (ext === 'm3u8' || ext === 'm3u') return 'HLS'
  if (ext === 'mpd') return 'DASH'
  if (ext === 'ts') return 'MPEGTS'

  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return 'YOUTUBE'
  if (EXTERNAL_HOSTS.some((host) => lowerUrl.includes(host))) return 'EXTERNAL'

  if (ext && ['mp4', 'webm', 'ogv', 'ogg', 'mkv', 'avi', 'mov', 'm4v'].includes(ext)) {
    return 'FILE'
  }

  return 'UNKNOWN'
}

const VideoPlayer = ({
  streamUrl,
  streamType: propStreamType,
  fileExt,
  title,
  onToggleFavorite,
  isFavorite = false,
  showMeta = true,
  onStreamError
}) => {
  const videoRef = useRef(null)
  const hlsRef = useRef(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [isMuted, setIsMuted] = useState(false)
  const [captionsEnabled, setCaptionsEnabled] = useState(false)

  const normalizedStreamType = (propStreamType || detectStreamType(streamUrl) || 'UNKNOWN').toUpperCase()
  const resolvedFileExt = fileExt || extractFileExt(streamUrl)

  const isYouTube = normalizedStreamType === 'YOUTUBE'
  const isExternal = normalizedStreamType === 'EXTERNAL'
  const isIptvOnly = IPTV_ONLY_TYPES.has(normalizedStreamType)
  const isFile = normalizedStreamType === 'FILE'
  const isUnknown = normalizedStreamType === 'UNKNOWN'

  const fileWarning = isFile && resolvedFileExt && !WEB_NATIVE_FILE_EXTS.has(resolvedFileExt)
    ? "This format isn't web-native. Convert to MP4 (H.264/AAC) or HLS for best compatibility."
    : null

  const unknownWarning = isUnknown
    ? 'Unknown stream type. Attempting HLS playback.'
    : null

  const getIptvOnlyMessage = () => {
    switch (normalizedStreamType) {
      case 'DASH':
        return 'DASH streams are marked IPTV-only. Publish as HLS to play in the browser.'
      case 'MPEGTS':
        return 'MPEG-TS streams are IPTV-only. Publish as HLS to play in the browser.'
      case 'RTMP_INGEST':
        return 'This is an ingest source. Publish as HLS/DASH to play in the browser.'
      default:
        return 'This stream type is not supported in the browser.'
    }
  }

  const renderNotice = (headline, body, action) => (
    <div className="w-full rounded-lg border border-amber-500/40 bg-slate-900/80 p-4 text-amber-100">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{headline}</p>
          {body && <p className="mt-1 text-xs text-amber-200/80">{body}</p>}
          {showMeta && title && <p className="mt-3 text-sm text-white">{title}</p>}
        </div>
        {onToggleFavorite && (
          <button
            type="button"
            onClick={onToggleFavorite}
            className="h-10 w-10 rounded-full bg-amber-500/20 text-white flex items-center justify-center hover:bg-amber-500/30"
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            {isFavorite ? '⭐' : '☆'}
          </button>
        )}
      </div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  )

  // Extract YouTube video ID
  const getYouTubeEmbedUrl = (url) => {
    if (!url) return null
    // Already an embed URL
    if (url.includes('youtube.com/embed/')) {
      // Add parameters for better experience
      const videoId = url.split('embed/')[1]?.split('?')[0]
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&cc_load_policy=1&cc_lang_pref=sq&rel=0`
    }
    // Watch URL format
    const match = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?]+)/)
    if (match) {
      return `https://www.youtube.com/embed/${match[1]}?autoplay=1&cc_load_policy=1&cc_lang_pref=sq&rel=0`
    }
    return url
  }

  useEffect(() => {
    if (!streamUrl) {
      setIsLoading(false)
      return
    }

    // Skip for YouTube/external/ingest-only streams
    if (isYouTube || isExternal || isIptvOnly) {
      setIsLoading(false)
      setErrorMessage('')
      return
    }

    const video = videoRef.current
    if (!video) return

    setIsLoading(true)
    setErrorMessage('')

    // Clean up previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    const playbackType = normalizedStreamType === 'UNKNOWN' ? 'HLS' : normalizedStreamType

    if (playbackType === 'FILE') {
      // Direct video URL (MP4, WebM, etc.) - use native HTML5 video
      video.src = streamUrl
      return
    }

    if (playbackType === 'HLS') {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true
        })
        hls.loadSource(streamUrl)
        hls.attachMedia(video)
        hlsRef.current = hls
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data?.fatal) {
            const message = 'Stream unavailable. Please try again.'
            setErrorMessage(message)
            onStreamError?.(message)
          }
        })

        return () => {
          if (hlsRef.current) {
            hlsRef.current.destroy()
          }
        }
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        video.src = streamUrl
      }
    } else {
      // Fallback - direct video URL
      video.src = streamUrl
    }
  }, [streamUrl, normalizedStreamType, isYouTube, isExternal, isIptvOnly])

  const handleLoaded = () => setIsLoading(false)
  const handleWaiting = () => setIsLoading(true)
  const handleError = () => {
    setIsLoading(false)
    const message = 'Stream unavailable. Please try again.'
    setErrorMessage(message)
    onStreamError?.(message)
  }

  const handleToggleMute = () => {
    const video = videoRef.current
    if (!video) return
    const nextMuted = !isMuted
    video.muted = nextMuted
    setIsMuted(nextMuted)
  }

  const handleToggleCaptions = () => {
    const video = videoRef.current
    if (!video) return
    const nextState = !captionsEnabled
    Array.from(video.textTracks || []).forEach((track) => {
      track.mode = nextState ? 'showing' : 'disabled'
    })
    setCaptionsEnabled(nextState)
  }

  const handleToggleFullscreen = () => {
    const video = videoRef.current
    if (!video) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      video.requestFullscreen?.()
    }
  }

  if (!streamUrl) {
    return renderNotice('Stream unavailable', 'No stream URL provided for this item.')
  }

  if (isIptvOnly) {
    return renderNotice('Playback not supported in browser', getIptvOnlyMessage())
  }

  if (isExternal) {
    const action = (
      <a
        href={streamUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-lg bg-amber-500/20 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-500/30"
      >
        Open external source
      </a>
    )
    return renderNotice('External source', 'This channel uses an external embed.', action)
  }

  // Render YouTube iframe
  if (isYouTube) {
    return (
      <div className="w-full bg-black rounded-lg overflow-hidden relative">
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <iframe
            src={getYouTubeEmbedUrl(streamUrl)}
            className="absolute inset-0 w-full h-full"
            title={title || 'YouTube Video'}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
        {showMeta && title && (
          <div className="p-4 bg-slate-800">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">{title}</h2>
              {onToggleFavorite && (
                <button
                  type="button"
                  onClick={onToggleFavorite}
                  className="h-10 w-10 rounded-full bg-slate-700 text-white flex items-center justify-center hover:bg-slate-600"
                  aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  {isFavorite ? '⭐' : '☆'}
                </button>
              )}
            </div>
            <p className="text-sm text-green-400 mt-1">Albanian subtitles available in player (CC button)</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="w-full bg-black rounded-lg overflow-hidden relative">
      <video
        ref={videoRef}
        controls
        autoPlay
        className="w-full h-auto"
        playsInline
        onLoadedData={handleLoaded}
        onPlaying={handleLoaded}
        onWaiting={handleWaiting}
        onError={handleError}
      >
        Your browser does not support the video tag.
      </video>
      <div className="absolute top-3 right-3 flex gap-2">
        <button
          type="button"
          onClick={onToggleFavorite}
          className="h-11 w-11 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          {isFavorite ? '⭐' : '☆'}
        </button>
        <button
          type="button"
          onClick={handleToggleMute}
          className="h-11 w-11 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
          aria-label="Toggle audio"
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
        <button
          type="button"
          onClick={handleToggleCaptions}
          className="h-11 w-11 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
          aria-label="Toggle captions"
        >
          {captionsEnabled ? 'CC' : 'CC'}
        </button>
        <button
          type="button"
          onClick={handleToggleFullscreen}
          className="h-11 w-11 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
          aria-label="Fullscreen"
        >
          📺
        </button>
      </div>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-500"></div>
            <span className="text-sm">Loading stream...</span>
          </div>
        </div>
      )}
      {errorMessage && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white px-4 text-center">
          <p className="text-base font-semibold">{errorMessage}</p>
          <p className="text-sm text-slate-300 mt-2">Check your connection or try again.</p>
        </div>
      )}
      {(unknownWarning || fileWarning) && (
        <div className="p-3 bg-slate-800/70 text-xs text-amber-200">
          {unknownWarning && <p>{unknownWarning}</p>}
          {fileWarning && <p className={unknownWarning ? 'mt-1' : ''}>{fileWarning}</p>}
        </div>
      )}
      {showMeta && title && (
        <div className="p-4 bg-slate-800">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
        </div>
      )}
    </div>
  )
}

export default VideoPlayer
