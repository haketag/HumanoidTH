import FavoritesList from './FavoritesList';
export const metadata = { title: 'รายการที่ถูกใจ | Favorites', robots: {index:false,follow:false} };
export default function FavoritesPage() {
  return <section><h1>รายการที่ถูกใจ</h1><p>บันทึกหุ่นยนต์ที่ถูกใจไว้ เพื่อกลับมาดูภายหลัง</p><p className="muted">รายการนี้เก็บในเบราว์เซอร์นี้เท่านั้น ไม่ซิงก์กับบัญชีหรืออุปกรณ์อื่น</p><FavoritesList/></section>;
}
