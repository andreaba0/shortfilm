import { parse as mpdParser } from 'mpd-parser';
import { useState, useRef, useEffect } from 'react';
import Image from 'next/image'
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { FaPlay, FaStop, FaReplyAll, FaPause } from 'react-icons/fa';
import { Player } from '@scripts/player'

function ProgressBar(props) {
    var [progress, setProgress] = useState((props.currentTime * 100 / props.max));
    var [seeking, setSeeking] = useState(false);
    var [hovering, setHovering] = useState(false);
    var [shadowProgress, setShadowProgress] = useState(0);
    var [mouseCoord, setMouseCoord] = useState({ x: 0, y: 0 });
    const progressBarRef = useRef(null);
    const time = props.max;
    const domain = props.imageDomain;

    useEffect(() => {
        if(seeking) return
        setProgress((props.currentTime * 100 / props.max))
    })

    useEffect(() => {
        function mouseUp() {
            setProgress(progress * props.max / 100)
            props.seek(progress * props.max / 100)
            setSeeking(false);
        }

        function mouseMove(e) {
            if (!seeking && !hovering) return;
            const rect = progressBarRef.current.getBoundingClientRect();
            setMouseCoord({ x: e.clientX, y: e.clientY });
            setProgress(getProgress(e.clientX))
        }

        function touchMove(e) {
            if (!seeking) return;
            const touches = e.touches;
            if (touches.length > 1) {
                setSeeking(false);
                return;
            }
            const rect = progressBarRef.current.getBoundingClientRect();
            setMouseCoord({ x: touches[0].clientX, y: touches[0].clientY });
            setProgress(getProgress(touches[0].clientX))
        }

        if (seeking) {
            document.addEventListener('mousemove', mouseMove);
            document.addEventListener('touchmove', touchMove);
            document.addEventListener('mouseup', mouseUp);
            document.addEventListener('touchend', mouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', mouseMove);
            document.removeEventListener('touchmove', touchMove);
            document.removeEventListener('mouseup', mouseUp);
            document.removeEventListener('touchend', mouseUp);
        }

    }, [seeking, progress, mouseCoord])

    function getTimeString() {
        const seconds = Math.floor(time * getProgress() / 100);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const secondsLeft = seconds % 60;
        const minutesLeft = minutes % 60;
        if (hours > 0) {
            return `${hours}:${minutesLeft < 10 ? '0' + minutesLeft : minutesLeft}:${secondsLeft < 10 ? '0' + secondsLeft : secondsLeft}`;
        }
        return `${minutesLeft}:${secondsLeft < 10 ? '0' + secondsLeft : secondsLeft}`;
    }

    function getStaticTimeString() {
        const seconds = Math.floor(props.currentTime);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const secondsLeft = seconds % 60;
        const minutesLeft = minutes % 60;
        if (hours > 0) {
            return `${hours}:${minutesLeft < 10 ? '0' + minutesLeft : minutesLeft}:${secondsLeft < 10 ? '0' + secondsLeft : secondsLeft}`;
        }
        return `${minutesLeft}:${secondsLeft < 10 ? '0' + secondsLeft : secondsLeft}`;
    }

    function renderTimeBox() {
        return (
            <div className="w-full h-5 text-white font-medium flex items-center flex-col text-xs">
                {getTimeString()}
            </div>
        )
    }

    function getImageName() {
        const seconds = Math.floor(time * getProgress() / 100);
        const image = Math.floor(seconds / 10) + 1
        const name = `thumbnail${image < 10 ? '00' + image : image < 100 ? '0' + image : image}.jpg`;
        return name
    }

    function getProgress(x) {
        const rect = progressBarRef.current.getBoundingClientRect();
        const mouseX = (x) ? x : mouseCoord.x
        const maxWidth = rect.width + rect.x;
        const minWidth = rect.x;
        if (mouseX > maxWidth) return 100
        if (mouseX < minWidth) return 0
        return (mouseX - minWidth) / (maxWidth - minWidth) * 100;
    }

    function getMargin(containerWidth) {
        const rect = progressBarRef.current.getBoundingClientRect();
        const middleBox = containerWidth / 2;
        if (mouseCoord.x - middleBox < rect.x) return ['left', 0]
        if (mouseCoord.x + middleBox > rect.x + rect.width) return ['right', 0]
        var left = mouseCoord.x - rect.x - middleBox;
        return ['left', left]
    }

    function renderShadowPoint() {
        if (!hovering) return null;
        if (seeking) return null;
        const boxWidth = 4;
        const [position, margin] = getMargin(boxWidth);
        return (
            <div className="w-1 z-10 h-4 absolute bg-yellow-500" style={{ [position]: margin }}>

            </div>
        )
    }

    function renderThumbnail() {
        if (!seeking && !hovering) return null;
        const rect = progressBarRef.current.getBoundingClientRect();
        const boxWidth = 144;
        const middleBox = boxWidth / 2;
        const [position, margin] = getMargin(boxWidth);
        return (
            <div className="absolute w-36 h-28 bg-gray-600 -top-36 flex flex-col items-center justify-between" style={{ [position]: margin }}>
                <Image
                    loader={({ src, width, quality }) => `${props.thumbnails}${src}`}
                    src={getImageName()}
                    alt="Picture of the author"
                    width={160}
                    height={90} />
                {renderTimeBox()}
            </div>
        )
    }

    function render() {
        return (
            <div className="w-full flex flex-row items-center justify-center">
                <div className="text-white w-12 flex items-center justify-center text-xs">
                    {getStaticTimeString()}
                </div>
                <div ref={progressBarRef} className="w-full h-1 bg-gray-200 items-start relative flex flex-row select-none"
                    onMouseEnter={() => { setHovering(true) }}
                    onMouseMove={(e) => {
                        setMouseCoord({ x: e.clientX, y: e.clientY });
                    }}
                    onMouseLeave={() => { setHovering(false) }}>
                    {renderThumbnail()}
                    {renderShadowPoint()}
                    <div style={{ width: `${progress}%` }} className="h-full relative bg-blue-500">
                        <div onTouchStart={(e) => {
                            if (e.touches.length > 1) return;
                            setMouseCoord({ x: e.touches[0].clientX, y: e.touches[0].clientY });
                            setSeeking(true)
                        }} onMouseDown={(e) => {
                            setMouseCoord({ x: e.clientX, y: e.clientY });
                            setSeeking(true)
                        }} className="w-5 h-5 z-20 rounded-full bg-blue-500 absolute -top-2 -right-2 hover:scale-110">

                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return render();
}

function PlayerAction(props) {
    function render() {
        if (props.status === 'play') return (<FaPause onClick={() => props.action('stop')} size={19} />)
        if (props.status === 'stop') return (<FaPlay onClick={() => props.action('play')} size={19} />)
        return (<FaReplyAll onClick={() => props.action('play')} size={19} />)
    }
    return render()
}

export function VideoPlayer(props) {
    var [openMenu, setOpenMenu] = useState(false);
    const videoRef = useRef(null);
    const playerRef = useRef(null);
    var [playStatus, setPlayStatus] = useState('stop');
    var [progress, setProgress] = useState(0);
    var [isInitialized, setIsInitialized] = useState(false);


    function getBufferFromApi(path) {
        return new Promise((resolve, reject) => {
            fetch(path)
                .then(res => res.arrayBuffer())
                .then(buffer => {
                    resolve(buffer)
                })
        })
    }

    useEffect(() => {
        if (playerRef.current) return;
        const video = videoRef.current;
        playerRef.current = videojs(video, {
            sources: [{
                src: props.manifest,
                type: 'application/dash+xml'
            }],
            controls: false,
            loadingSpinner: false,
        })

        return () => {
            playerRef.current.dispose();
        }
    }, [props.manifest])

    useEffect(() => {
        if (!playerRef.current) return;
        const video = videoRef.current;
        function playerTimeUpdate(e) {
            setProgress(playerRef.current.currentTime())
        }

        function playerEnded() {
            setPlayStatus('replay')
        }
        function playerPlay() {
            setPlayStatus('play')
        }
        function playerPause() {
            setPlayStatus('stop')
        }
        video.addEventListener('timeupdate', playerTimeUpdate)
        video.addEventListener('ended', playerEnded)
        video.addEventListener('play', playerPlay)
        video.addEventListener('pause', playerPause)
        return () => {
            video.removeEventListener('timeupdate', playerTimeUpdate)
            video.removeEventListener('ended', playerEnded)
            video.removeEventListener('play', playerPlay)
            video.removeEventListener('pause', playerPause)
        }
    })

    useEffect(() => {
        const video = videoRef.current;
        if (openMenu) return;
        const videoDiv = document.getElementById('video-element');
        function openMenuEvent() {
            setOpenMenu(true);
        }
        videoDiv.addEventListener('click', openMenuEvent)
        videoDiv.addEventListener('mouseover', openMenuEvent)
        return () => {
            videoDiv.removeEventListener('click', openMenuEvent)
            videoDiv.removeEventListener('mouseover', openMenuEvent)
        }
    }, [openMenu])

    useEffect(() => {
        const video = videoRef.current;
        if (playStatus === 'play') {
            video.play();
        } else if (playStatus === 'stop') {
            video.pause();
        }
    }, [playStatus])

    function seekToTime(time) {
        setProgress(time);
        playerRef.current.currentTime(time);
    }

    function renderMenu() {
        if (!openMenu) return null;
        return (
            <div className="w-full h-full flex flex-col items-center justify-end absolute top-0 left-0">
                <div className="w-full flex flex-row items-center justify-center h-14">
                    <div className="w-8 h-5 flex items-center justify-center cursor-pointer text-white">
                        <PlayerAction status={playStatus} action={setPlayStatus} />
                    </div>
                    <div className="flex-grow relative">
                        <ProgressBar max={3558} thumbnails={props.thumbnails} currentTime={progress} seek={seekToTime} />
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div id="video-element" className="flex w-full h-full items-center justify-center flex-col relative bg-black">
            <video ref={videoRef} id="video" controls={false} className="video-js" />
            <style>{`.vjs-default-skin.vjs-seeking .vjs-loading-spinner { display: none; }`}</style>
            {renderMenu()}
        </div>
    )
}