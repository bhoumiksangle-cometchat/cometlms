import { Play } from 'lucide-react';

export function CourseVideoPlayer({ videoUrl, title }: { videoUrl?: string; title: string }) {
  const testVideoUrl = 'https://www.youtube.com/watch?v=OwZUkNgSk7E';
  const sourceUrl = videoUrl || testVideoUrl;

  const isDirectVideo = /\.mp4|\.webm|\.ogg/i.test(sourceUrl);
  const embedUrl = sourceUrl.includes('youtube.com/watch?v=')
    ? sourceUrl.replace('watch?v=', 'embed/')
    : sourceUrl;

  return isDirectVideo ? (
    <video className="w-full aspect-video bg-black" controls controlsList="nodownload">
      <source src={sourceUrl} />
    </video>
  ) : (
    <iframe
      src={embedUrl}
      title={title}
      className="w-full aspect-video"
      allowFullScreen
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    />
  );
}
