import { parse as mpdParser } from 'mpd-parser';
import { useState, useRef, useEffect } from 'react';
import Image from 'next/image'
import {VideoPlayer} from '@components/player';

export async function getServerSideProps(context) {
    const { params } = context;
    const { id } = params;
    const manifestApi = await fetch(`http://${process.env.BACKEND_URL}/cdn/streaming/${id}/manifest_${id}.mpd`);
    const manifest = mpdParser(await manifestApi.text())
    return {
        props: {
            domain: context.req.headers.host,
            video_id: id
        }
    }
}



export default function PlayerPage(props) {

    return (
        <div className="w-screen overflow-x-hidden relative flex flex-col items-center h-screen max-h-screen overflow-y-hidden">
            <div className="w-full h-full">
                <VideoPlayer 
                    manifest={`http://${props.domain}/cdn/streaming/${props.video_id}/manifest_${props.video_id}.mpd`}
                    thumbnails={`http://${props.domain}/cdn/streaming/${props.video_id}/`}
                    segments={`http://${props.domain}/cdn/streaming/${props.video_id}/`}
                />
            </div>
        </div>
    )
}