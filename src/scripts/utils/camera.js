export default class Camera {
  #video;
  #canvas;
  #stream = null;

  constructor({ video, canvas }) {
    this.#video = video;
    this.#canvas = canvas;
  }

  get isActive() {
    return this.#stream !== null;
  }

  async start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Browser Anda tidak mendukung akses kamera.');
    }

    this.#stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
    this.#video.srcObject = this.#stream;
    await this.#video.play();
  }

  stop() {
    if (this.#stream) {
      this.#stream.getTracks().forEach((track) => track.stop());
    }
    this.#stream = null;
    this.#video.srcObject = null;
  }

  capture({ maxWidth = 1280, quality = 0.8 } = {}) {
    const videoWidth = this.#video.videoWidth;
    const videoHeight = this.#video.videoHeight;

    if (!videoWidth || !videoHeight) {
      return Promise.reject(new Error('Kamera belum siap. Coba lagi sesaat lagi.'));
    }

    const scale = Math.min(1, maxWidth / videoWidth);
    const width = Math.round(videoWidth * scale);
    const height = Math.round(videoHeight * scale);

    this.#canvas.width = width;
    this.#canvas.height = height;
    this.#canvas.getContext('2d').drawImage(this.#video, 0, 0, width, height);

    return new Promise((resolve, reject) => {
      this.#canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Gagal mengambil foto.'))),
        'image/jpeg',
        quality,
      );
    });
  }
}
