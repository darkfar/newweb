export default class AboutPage {
  async render() {
    return `
      <section class="container">
        <h1>Tentang Aplikasi</h1>
        <p class="page-lead">
          Story Map adalah aplikasi untuk membagikan cerita beserta lokasinya.
          Setiap cerita ditampilkan dalam daftar dan ditandai pada peta digital.
        </p>
        <ul class="about-list">
          <li>Jelajahi cerita pengguna lain pada peta interaktif.</li>
          <li>Tambahkan ceritamu dengan foto dari berkas atau kamera, lalu pilih lokasinya di peta.</li>
          <li>Pilih tampilan peta: OpenStreetMap, OpenTopoMap, atau citra satelit.</li>
        </ul>
      </section>
    `;
  }

  async afterRender() {}
}
