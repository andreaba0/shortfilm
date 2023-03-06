import { parse as mpdParser } from 'mpd-parser';
import { useState, useRef, useEffect } from 'react';
import Image from 'next/image'

export async function getServerSideProps(context) {
    const { params } = context;
    const { id } = params;
    const manifestApi = await fetch(`http://${process.env.BACKEND_URL}/cdn/streaming/${id}/manifest_${id}.mpd`);
    const manifest = mpdParser(await manifestApi.text())
    return {
        props: {
            manifest,
            domain: context.req.headers.host
        }
    }
}

function imageLoader({ src, width, quality }) {
    //get page host name in client side code
    const domain = window.location.hostname;
    return `http://${domain}/cdn/streaming/35e65669-a44b-4be4-9459-5cb79147f420/${src}`
}

function ProgressBar(props) {
    var [progress, setProgress] = useState(0);
    var [seeking, setSeeking] = useState(false);
    var [hovering, setHovering] = useState(false);
    var [shadowProgress, setShadowProgress] = useState(0);
    var [mouseCoord, setMouseCoord] = useState({ x: 0, y: 0 });
    const progressBarRef = useRef(null);
    const time = props.max;
    const domain = props.imageDomain;
    console.log(domain)

    useEffect(() => {

    })

    useEffect(() => {
        function mouseUp() {
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
        console.log(name)
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
        if(!hovering) return null;
        if(seeking) return null;
        const boxWidth = 8;
        const [position, margin] = getMargin(boxWidth);
        return (
            <div className="w-2 z-10 h-4 absolute bg-yellow-500" style={{[position]: margin}}>

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
            <div className="absolute w-36 h-28 bg-gray-600 -top-36 flex flex-col items-center justify-between" style={{[position]: margin}}>
                <Image
                    loader={imageLoader}
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
        )
    }

    return render();
}

export default function PlayerPage(props) {
    return (
        <div className="w-screen relative py-14 px-6 flex flex-col items-center">
            <div className="w-full h-72 flex items-center justify-center">
                Video
            </div>
            <div className="w-full max-w-sm">
                <ProgressBar max={3558} imageDomain={props.domain} />
            </div>
        </div>
    )
}