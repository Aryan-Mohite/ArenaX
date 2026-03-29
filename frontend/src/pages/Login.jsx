function Login() {
  const container = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "80vh",
  };

  const box = {
    background: "#020617",
    padding: "30px",
    borderRadius: "10px",
    width: "300px",
  };

  const input = {
    width: "100%",
    padding: "10px",
    marginBottom: "15px",
  };

  const button = {
    width: "100%",
    padding: "10px",
    background: "#38bdf8",
    border: "none",
    cursor: "pointer",
  };

  return (
    <div style={container}>
      <div style={box}>
        <h2>Login</h2>

        <input style={input} placeholder="Email" />

        <input style={input} placeholder="Password" type="password" />

        <button style={button}>Login</button>
      </div>
    </div>
  );
}

export default Login;
