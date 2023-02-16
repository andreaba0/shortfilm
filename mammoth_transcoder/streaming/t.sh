ffmpeg -i concert.mp4 \
\
-metadata:s:a language=ita \
-c:a aac -b:a 128k \
-c:v libx264 -x264opts 'keyint=48:min-keyint=48:no-scenecut' \
-profile:v high -level 4.1 -crf 28 -b:v 5M \
-muxrate 4M -bufsize 4M -maxrate 4M \
-pix_fmt yuv420p \
-hls_flags independent_segments+delete_segments \
-f hls -hls_time 10 \
-hls_playlist_type vod \
-hls_segment_filename 'segments/output_high_%03d.mp4' -s 1920x1088 \
segments/video_high.m3u8 \
\
-metadata:s:a language=ita \
-c:a aac -b:a 128k \
-c:v libx264 -x264opts 'keyint=48:min-keyint=48:no-scenecut' \
-profile:v high -level 4.1 -crf 30 -b:v 300k \
-muxrate 4M -bufsize 4M -maxrate 4M \
-pix_fmt yuv420p \
-hls_flags independent_segments+delete_segments \
-f hls -hls_time 10 \
-hls_playlist_type vod \
-hls_segment_filename 'segments/output_low_%03d.mp4' -s 480x360 \
segments/video_low.m3u8