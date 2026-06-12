export class WebRTCClient {
  peer?: RTCPeerConnection;
  localStream?: MediaStream;

  async start(video = true) {
    this.localStream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
    this.peer = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    this.localStream.getTracks().forEach((track) => {
      this.peer?.addTrack(track, this.localStream!);
    });

    return this.localStream;
  }

  async createOffer() {
    const offer = await this.peer?.createOffer();
    if (!offer || !this.peer) return null;
    await this.peer.setLocalDescription(offer);
    return offer;
  }
}
