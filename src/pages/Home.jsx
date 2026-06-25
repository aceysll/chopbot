import { useNavigate } from "react-router-dom";

const C = {
  bg:"#0c0c10",surface:"#13131a",elevated:"#1c1c26",border:"#ffffff0f",
  borderHi:"#ffffff1a",accent:"#ff3c5f",accentSub:"#ff3c5f22",accentHi:"#ff6080",
  text:"#f0f0f4",sub:"#9090a8",muted:"#50506a",
};
const FONT = "'Inter','SF Pro Display',system-ui,sans-serif";
const steps = [
  {n:"01",title:"Upload a video",desc:"Any format works. MP4, MOV, AVI. Drop it in or click to browse."},
  {n:"02",title:"Pick a clip length",desc:"Choose how long each segment should be. Shorter means more chaos."},
  {n:"03",title:"Chop and download",desc:"Chopbot slices, shuffles, and stitches. Your new video downloads automatically."},
];

export default function Home() {
  const navigate = useNavigate();
  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:FONT,display:"flex",flexDirection:"column"}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;}a{text-decoration:none;}@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}.f1{animation:fadeUp 0.6s ease 0.05s both}.f2{animation:fadeUp 0.6s ease 0.15s both}.f3{animation:fadeUp 0.6s ease 0.25s both}.f4{animation:fadeUp 0.6s ease 0.35s both}.f5{animation:fadeUp 0.6s ease 0.45s both}`}</style>
      <nav style={{padding:"20px 32px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${C.border}`}}>
        <div style={{fontSize:18,fontWeight:800,letterSpacing:"-0.03em"}}>chop<span style={{color:C.accent}}>bot</span></div>
        <a href="https://buildbyace.vercel.app" target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:C.muted}}>by ace ↗</a>
      </nav>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"64px 24px",textAlign:"center"}}>
        <div className="f1" style={{display:"inline-flex",alignItems:"center",gap:6,padding:"4px 12px",borderRadius:20,background:C.accentSub,border:`1px solid ${C.accent}30`,fontSize:11,fontWeight:600,color:C.accent,letterSpacing:"0.06em",marginBottom:28}}>
          <span style={{width:5,height:5,borderRadius:"50%",background:C.accent}}/> FREE · NO ACCOUNT NEEDED
        </div>
        <h1 className="f2" style={{fontSize:"clamp(36px,8vw,72px)",fontWeight:800,letterSpacing:"-0.04em",lineHeight:1.05,marginBottom:20,maxWidth:700}}>
          Your video,<br/><span style={{color:C.accent}}>reshuffled.</span>
        </h1>
        <p className="f3" style={{fontSize:16,color:C.sub,lineHeight:1.7,maxWidth:460,marginBottom:40}}>
          Upload any video. Pick a clip length. Chopbot slices it into segments, randomises the order, and stitches it back into one file. Ready to download in seconds.
        </p>
        <div className="f4">
          <button onClick={() => navigate("/edit")} style={{padding:"16px 36px",borderRadius:12,border:"none",background:C.accent,color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:FONT,letterSpacing:"-0.01em",boxShadow:`0 0 32px ${C.accent}44`}}>
            Get started ✂
          </button>
          <div style={{fontSize:12,color:C.muted,marginTop:12}}>All processing happens in your browser. Nothing is uploaded.</div>
        </div>
        <div className="f5" style={{marginTop:80,width:"100%",maxWidth:640,textAlign:"left"}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:C.muted,marginBottom:24,textAlign:"center"}}>How it works</div>
          <div style={{display:"flex",flexDirection:"column",gap:1,borderRadius:14,overflow:"hidden",border:`1px solid ${C.border}`}}>
            {steps.map((step,i) => (
              <div key={i} style={{display:"flex",gap:20,padding:"20px 24px",background:C.surface,borderBottom:i<steps.length-1?`1px solid ${C.border}`:"none",alignItems:"flex-start"}}>
                <div style={{fontSize:11,fontWeight:700,color:C.accent,letterSpacing:"0.06em",flexShrink:0,paddingTop:2}}>{step.n}</div>
                <div>
                  <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>{step.title}</div>
                  <div style={{fontSize:13,color:C.sub,lineHeight:1.6}}>{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
