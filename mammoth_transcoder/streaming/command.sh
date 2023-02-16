#!/bin/bash

ffmpeg -i rios.mp4 \
-map 0:v:0 -map 0:a:0 -map 0:v:0 \
-c:1 aac -c:0 libvpx -c:2 libvpx \
-b:0 5M -b:2 500k \
-filter:2 scale=480x854 \
-crf:0 19 -crf:2 30 \
-sc_threshold 0 \
-b_strategy 0 \
-use_template 0 \
-use_timeline 0 \
-metadata:s:1 language=IT \
-adaptation_sets "id=0,streams=0,2 id=1,streams=1" \
-g 15 \
-single_file 0 \
-segment_time 5 \
-movflags frag_keyframe+empty_moov \
-seg_duration 1 \
-progress - \
-v quiet \
-v error \
-f dash dash.mpd