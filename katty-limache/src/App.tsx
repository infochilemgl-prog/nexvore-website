import Header from "./components/Header";
import Hero from "./components/Hero";
import QuickAccess from "./components/QuickAccess";
import Menu from "./components/Menu";
import Promociones from "./components/Promociones";
import EventosQR from "./components/EventosQR";
import Historia from "./components/Historia";
import ResenasMapa from "./components/ResenasMapa";
import Footer from "./components/Footer";
import WhatsAppFloat from "./components/WhatsAppFloat";

export default function App() {
  return (
    <div className="min-h-screen bg-cream">
      <Header />
      <main>
        <Hero />
        <QuickAccess />
        <Menu />
        <Promociones />
        <EventosQR />
        <Historia />
        <ResenasMapa />
      </main>
      <Footer />
      <WhatsAppFloat />
    </div>
  );
}
