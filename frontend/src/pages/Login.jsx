import { useState } from "react";
import { loginUser } from "../services/authService";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const res = await loginUser(form);
      localStorage.setItem("token", res.data.token);
      alert("Login success");
    } catch {
      alert("Login failed");
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <input onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <input type="password" onChange={(e) => setForm({ ...form, password: e.target.value })} />
      <button>Login</button>
    </form>
  );
}