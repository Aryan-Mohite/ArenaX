import { BrowserRouter } from "react-router-dom";
import RoutesConfig from "./routes";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import { AuthProvider } from "./context/AuthContext";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="flex bg-[#0f172a] text-white min-h-screen">

          <Sidebar />

          <div className="flex-1">

            <Navbar />

            <div className="p-6">
              <RoutesConfig />
            </div>

          </div>

        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;