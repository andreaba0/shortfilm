import {parse as mpdParser} from 'mpd-parser';
import {useState, useRef, useEffect} from 'react';

export async function getServerSideProps(context) {
    const { params } = context;
    const { id } = params;
    const manifestApi = await fetch(`http://${process.env.BACKEND_URL}/cdn/streaming/${id}/manifest_${id}.mpd`);
    const manifest = mpdParser(await manifestApi.text())
    return {
        props: {
            manifest
        }
    }
}

function ProgressBar(props) {
    var [progress, setProgress] = useState(0);
    var [change, setChange] = useState(false);
    const progressBarRef = useRef(null);

    useEffect(() => {
        function mouseUp() {
            setChange(false);
        }

        function mouseMove(e) {
            if (!change) return;
            const rect = progressBarRef.current.getBoundingClientRect();
            const mouseX = e.clientX
            const maxWidth = rect.width+rect.x;
            const minWidth = rect.x;
            if (mouseX > maxWidth) {
                setProgress(100);
                return;
            }
            if (mouseX < minWidth) {
                setProgress(0);
                return;
            }
            setProgress((mouseX-minWidth)/(maxWidth-minWidth)*100);
            console.log(progress)
        }

        if(change) {
            document.addEventListener('mousemove', mouseMove);
            document.addEventListener('mouseup', mouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', mouseMove);
            document.removeEventListener('mouseup', mouseUp);
        }

    }, [change, progress])

    function render() {
        return (
            <div ref={progressBarRef} className="w-full h-2 bg-gray-200 items-start relative flex flex-row">
                <div style={{width: `${progress}%`}} className="h-full relative bg-blue-500">
                    <div onMouseDown={()=>{setChange(true)}} className="w-4 h-4 rounded-full bg-blue-500 absolute -top-1 -right-1 hover:scale-110">

                    </div>
                </div>
            </div>
        )
    }

    return render();
}

export default function PlayerPage(props) {
    return (
        <div className="w-screen relative py-7 px-6">
            <ProgressBar max={3558} />
        </div>
    )
}