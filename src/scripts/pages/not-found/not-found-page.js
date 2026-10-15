export default class NotFoundPage {
  async render() {
    return `
      <section class="container">
        <h1>Halaman tidak ditemukan</h1>
        <p class="page-lead">Alamat yang Anda tuju tidak tersedia. <a href="#/">Kembali ke beranda</a>.</p>
      </section>
    `;
  }

  async afterRender() {}
}
