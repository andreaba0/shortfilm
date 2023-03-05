import { useState } from "react"
import Link from "next/link"
import { v4 as uuidv4 } from 'uuid';

export async function getServerSideProps(context) {
    const postListApi = await fetch(`http://${process.env.BACKEND_URL}/api/video/list`, {
        method: 'GET'
    })
    if (postListApi.status !== 200) return {
        props: {}
    }

    return {
        props: {
            data: await postListApi.json()
        }
    }
}

function RenderLink(props) {
    return (
        <div className="py-3 text-gray-800 font-medium text-center w-full">
            <Link href={`/player/${props.link}`}>{props.name}</Link>
        </div>
    )
}

export default function PostListPage(props) {

    var [videos, setVideos] = useState(props.data)

    function render() {
        var res = []
        for (var i = 0; i < videos.length; i++)
            res.push(<RenderLink name={videos[i].name} link={videos[i].id} key={uuidv4()} />)
        return res
    }

    return (
        <div className="w-screen">
            <div className="w-full max-w-2xl flex flex-col items-center space-y-4 mt-9">
                {render()}
            </div>
        </div>
    )
}