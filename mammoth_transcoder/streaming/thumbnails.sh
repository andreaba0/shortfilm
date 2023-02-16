ffmpeg -i concert.mp4 \
-vf scale=320:-1 -vsync vfr -r 1 \
-f image2 thumbnails/thumbnail%03d.jpg