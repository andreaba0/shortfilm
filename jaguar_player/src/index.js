(() => {
    var player = videojs('vid1');
    var path = window.location.pathname;
    var page = path.split("/").pop();
    player.src({ src: `/cdn/streaming/${page}/manifest_${page}.mpd`, type: 'application/dash+xml' });
})()