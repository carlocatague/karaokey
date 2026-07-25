import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import RoomDetail from './pages/RoomDetail';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/room/:id" element={<RoomDetail />} />
    </Routes>
  );
}
