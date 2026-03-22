import { SignUp } from "@clerk/nextjs"

export default function SignUpPage() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#2b2a25",
    }}>
      <SignUp />
    </div>
  )
}
