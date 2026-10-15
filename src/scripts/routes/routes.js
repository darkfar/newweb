import HomePage from '../pages/home/home-page';
import AboutPage from '../pages/about/about-page';
import LoginPage from '../pages/auth/login-page';
import RegisterPage from '../pages/auth/register-page';
import AddPage from '../pages/add/add-page';
import DetailPage from '../pages/detail/detail-page';
import SavedPage from '../pages/saved/saved-page';

const routes = {
  '/': new HomePage(),
  '/about': new AboutPage(),
  '/login': new LoginPage(),
  '/register': new RegisterPage(),
  '/add': new AddPage(),
  '/saved': new SavedPage(),
  '/stories/:id': new DetailPage(),
};

// Halaman yang hanya boleh diakses setelah login.
export const protectedRoutes = ['/', '/add', '/saved', '/stories/:id'];

// Halaman yang hanya untuk pengguna yang belum login.
export const guestRoutes = ['/login', '/register'];

export default routes;
