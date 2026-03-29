function Register() {
  const box = {
    width: "320px",
    margin: "80px auto",
    padding: "30px",
    background: "#020617",
    borderRadius: "10px",
  };

  const input = {
    width: "100%",
    padding: "10px",
    marginBottom: "15px",
  };

  const button = {
    width: "100%",
    padding: "10px",
    background: "#22c55e",
    border: "none",
  };

  return (
    <div style={box}>
      <h2>Register</h2>

      <input style={input} placeholder="Username" />

      <input style={input} placeholder="Email" />

      <input style={input} type="password" placeholder="Password" />

      <button style={button}>Create Account</button>
    </div>
  );
}

export default Register;
