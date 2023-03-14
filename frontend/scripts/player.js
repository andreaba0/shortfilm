export class Player {
    mediaSource = new MediaSource()
    manifest = null
    parsedManifest = null
    eventListeners = {};
    videoDuration = 0

    constructor(video) {
        this.video = video
    }

    loadManifest(manifestURL) {
        fetch(manifestURL)
            .then(res => {
                if (res.status < 200 || res.status > 299) {
                    this.#dispatchEv('error', { message: 'manifest fetch error', code: 101 })
                    return null
                }
                return res.text()
            })
            .then(manifest => {
                if (!manifest) return
                const parser = new DOMParser();
                const xml = parser.parseFromString(manifest, 'text/xml');
                //after parsing we get MPD element
                const mpd = xml.getElementsByTagName('MPD')[0];
                //get the duration of the video
                const duration = mpd.getAttribute('mediaPresentationDuration');
                const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+\.?\d*)S)?/;
                const matches = duration.match(regex);

                const hours = matches[1] ? parseInt(matches[1]) : 0;
                const minutes = matches[2] ? parseInt(matches[2]) : 0;
                const seconds = matches[3] ? parseFloat(matches[3]) : 0;
                const durationInSeconds = (hours * 3600) + (minutes * 60) + seconds;
                this.videoDuration = durationInSeconds
                this.manifest = mpd
                this.#dispatchEv('manifestloaded', {})
            })
            .catch(err => {
                this.#dispatchEv('error', { message: 'manifest error', code: 100 })
            })
    }

    #parseVideoQuality(videoQualities, adaptationSet) {
        const representations = adaptationSet.getElementsByTagName('Representation')
        for (let j = 0; j < representations.length; j++) {
            const representation = representations[j]
            const id = representation.getAttribute('id')
            const segmentTemplate = representation.getElementsByTagName('SegmentTemplate')[0]
            const segmentTimescale = segmentTemplate.getAttribute('timescale')
            const segmentName = segmentTemplate.getAttribute('media').replace('$RepresentationID$', id)
            const initialization = segmentTemplate.getAttribute('initialization')
            const segmentTimeline = segmentTemplate.getElementsByTagName('SegmentTimeline')[0]
            videoQualities.push({
                width: representation.getAttribute('width'),
                height: representation.getAttribute('height'),
                bandwidth: representation.getAttribute('bandwidth'),
                codecs: representation.getAttribute('codecs'),
                mimeType: representation.getAttribute('mimeType'),
                segmentTemplate: segmentName,
                segments: []
            })
            const currentIndex = videoQualities.length - 1
            videoQualities[currentIndex].segments.push({
                type: 'init',
                url: initialization.replace('$RepresentationID$', id)
            })
            const s = segmentTimeline.getElementsByTagName('S')
            for (var k = 0; k < s.length; k++) {
                const segment = s[k]
                const segmentDuration = segment.getAttribute('d')
                const segmentRepeat = parseInt(segment.getAttribute('r'))
                videoQualities[currentIndex].segments.push({
                    duration: parseInt(segmentDuration) / parseInt(segmentTimescale),
                    repeat: segmentRepeat || 1,
                })
            }
        }
    }

    parseManifest() {
        if (!this.manifest) {
            this.#dispatchEv('error', { message: 'load manifest first', code: 200 })
            return
        }
        var videoQualities = []
        var audios = []
        var subtitles = []
        const periods = this.manifest.getElementsByTagName('Period')[0]
        const adaptationSets = periods.getElementsByTagName('AdaptationSet')
        for (let i = 0; i < adaptationSets.length; i++) {
            const adaptationSet = adaptationSets[i]
            const contentType = adaptationSet.getAttribute('contentType')
            if (contentType === 'video') this.#parseVideoQuality(videoQualities, adaptationSet)
        }
        this.videoQualities = videoQualities
        this.audios = audios
        this.#dispatchEv('manifestparsed', {})
    }

    routine() {
        
    }

    addEventListener(type, listener) {
        if (!(type in this.eventListeners)) {
            this.eventListeners[type] = [];
        }
        this.eventListeners[type].push(listener);
    };
    removeEventListener(type, listener) {
        if (!this.eventListeners[type]) return
        let listeners = this.eventListeners[type];
        let index = listeners.indexOf(listener);
        if (index !== -1) {
            listeners.splice(index, 1);
        }
    };

    #dispatchEv(type, event) {
        if (!this.eventListeners[type]) return
        for (let i = 0; i < this.eventListeners[type].length; i++) {
            this.eventListeners[type][i](event);
        }
    };
}