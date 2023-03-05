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
    var [change, setChange] = useState(false);
    var [mouseCoord, setMouseCoord] = useState({ x: 0, y: 0 });
    const progressBarRef = useRef(null);
    const time = props.max;
    const domain = props.imageDomain;
    console.log(domain)

    useEffect(() => {
        function mouseUp() {
            setChange(false);
        }

        function mouseMove(e) {
            if (!change) return;
            const rect = progressBarRef.current.getBoundingClientRect();
            setMouseCoord({ x: e.clientX, y: e.clientY });
            const mouseX = e.clientX
            const maxWidth = rect.width + rect.x;
            const minWidth = rect.x;
            if (mouseX > maxWidth) {
                setProgress(100);
                return;
            }
            if (mouseX < minWidth) {
                setProgress(0);
                return;
            }
            setProgress((mouseX - minWidth) / (maxWidth - minWidth) * 100);
        }

        function touchMove(e) {
            if (!change) return;
            const touches = e.touches;
            if (touches.length > 1) {
                setChange(false);
                return;
            }
            const rect = progressBarRef.current.getBoundingClientRect();
            setMouseCoord({ x: touches[0].clientX, y: touches[0].clientY });
            const mouseX = touches[0].clientX
            const maxWidth = rect.width + rect.x;
            const minWidth = rect.x;
            if (mouseX > maxWidth) {
                setProgress(100);
                return;
            }
            if (mouseX < minWidth) {
                setProgress(0);
                return;
            }
            setProgress((mouseX - minWidth) / (maxWidth - minWidth) * 100);
        }

        if (change) {
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

    }, [change, progress, mouseCoord])

    function getTimeString() {
        const seconds = Math.floor(time * progress / 100);
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
        //image is an int in form thumbnailXXX.jpg
        //int starts from 1
        //int should be incremented every 5 seconds
        const seconds = Math.floor(time * progress / 100);
        const image = Math.floor(seconds / 10) +1
        const name = `thumbnail${image < 10 ? '00' + image : image < 100 ? '0' + image : image}.jpg`;
        console.log(name)
        return name
    }

    function renderThumbnail() {
        if (!change) return;
        const rect = progressBarRef.current.getBoundingClientRect();
        const boxWidth = 144;
        const middleBox = boxWidth / 2;
        if (mouseCoord.x - middleBox < rect.x) return (
            <div className="absolute w-36 h-28 bg-gray-600 left-0 -top-36 flex flex-col items-center justify-between">
                <Image
                    loader={imageLoader}
                    src={getImageName()}
                    alt="Picture of the author"
                    width={160}
                    height={90} />
                {renderTimeBox()}
            </div>
        )
        if (mouseCoord.x + middleBox > rect.x + rect.width) return (
            <div className="absolute w-36 h-28 bg-gray-600 right-0 -top-36 flex flex-col items-center justify-between">
                <Image
                    loader={imageLoader}
                    src={getImageName()}
                    alt="Picture of the author"
                    width={160}
                    height={90} />
                {renderTimeBox()}
            </div>
        )
        var left = mouseCoord.x - rect.x - middleBox;
        return (
            <div className="absolute w-36 -top-36 h-28 bg-gray-600 flex flex-col items-center justify-between" style={{ left: `${left}px` }}>
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
            <div ref={progressBarRef} className="w-full h-1 bg-gray-200 items-start relative flex flex-row select-none">
                {renderThumbnail()}
                <div style={{ width: `${progress}%` }} className="h-full relative bg-blue-500">
                    <div onTouchStart={(e) => {
                        if (e.touches.length > 1) return;
                        setMouseCoord({ x: e.touches[0].clientX, y: e.touches[0].clientY });
                        setChange(true)
                    }} onMouseDown={(e) => {
                        setMouseCoord({ x: e.clientX, y: e.clientY });
                        setChange(true)
                    }} className="w-5 h-5 rounded-full bg-blue-500 absolute -top-2 -right-2 hover:scale-110">

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