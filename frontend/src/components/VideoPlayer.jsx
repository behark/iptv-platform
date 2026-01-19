import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'

const VideoPlayer = ({
  streamUrl,
  streamType = 'HLS',
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

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (!streamUrl) {
      const message = 'Stream unavailable. Please try again.'
      setIsLoading(false)
      setErrorMessage(message)
      onStreamError?.(message)
      return
    }
    setIsLoading(true)
    setErrorMessage('')

    if (streamType === 'HLS') {
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
      // Direct video URL
      video.src = streamUrl
    }
  }, [streamUrl, streamType])

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
      {showMeta && title && (
        <div className="p-4 bg-slate-800">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
        </div>
      )}
    </div>
  )
}

export default VideoPlayer
