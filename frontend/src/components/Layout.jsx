import Navbar from "./Navbar";
import Footer from "./Footer";

// Wraps normal pages with the site Navbar + Footer.
// Pages that shouldn't show these (e.g. NotFound) are routed outside this layout.
export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}