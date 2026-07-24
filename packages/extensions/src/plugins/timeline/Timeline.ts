import type { TimelineSchema, Track, Keyframe } from '@3d-editor/editor'

export class Timeline {
  public data: TimelineSchema

  constructor(schema?: Partial<TimelineSchema>) {
    this.data = {
      id: schema?.id || `timeline-${Date.now()}`,
      name: schema?.name || 'Timeline',
      duration: schema?.duration || 5,
      tracks: schema?.tracks || [],
      markers: schema?.markers || [],
      autoPlay: schema?.autoPlay ?? false,
      loop: schema?.loop ?? false
    }
  }

  addTrack(track: Track): void {
    this.data.tracks.push(track)
  }

  addKeyframe(trackId: string, keyframe: Keyframe): void {
    const track = this.data.tracks.find((t: Track) => t.id === trackId)
    if (!track) return
    track.keyframes.push(keyframe)
    track.keyframes.sort((a: Keyframe, b: Keyframe) => a.time - b.time)
  }
}

