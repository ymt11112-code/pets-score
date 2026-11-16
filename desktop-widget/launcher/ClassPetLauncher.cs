using System;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Diagnostics;
using System.Windows.Forms;
public static class ClassPetLauncher {
  public static string Latest(string folder) {
    if (String.IsNullOrWhiteSpace(folder) || !Path.IsPathRooted(folder) || !Directory.Exists(folder)) return null;
    var pattern = new Regex(@"^班級加點小工具 (\d+)\.(\d+)\.(\d+)( \(\d+\))?\.exe$",RegexOptions.IgnoreCase|RegexOptions.CultureInvariant);
    string best=null;Version version=null;DateTime stamp=DateTime.MinValue;
    foreach(string file in Directory.GetFiles(folder,"*.exe",SearchOption.TopDirectoryOnly)) {
      var m=pattern.Match(Path.GetFileName(file));if(!m.Success)continue;
      int major,minor,patch;if(!Int32.TryParse(m.Groups[1].Value,out major)||!Int32.TryParse(m.Groups[2].Value,out minor)||!Int32.TryParse(m.Groups[3].Value,out patch))continue;
      var next=new Version(major,minor,patch);var changed=File.GetLastWriteTimeUtc(file);
      if(version==null||next.CompareTo(version)>0||(next.Equals(version)&&changed>stamp)){version=next;best=file;stamp=changed;}
    }
    return best;
  }
  [STAThread] public static int Main(string[] args) {
    bool probe=args.Length==2&&args[0]=="--probe";
    try {
      if(probe){string found=Latest(args[1]);if(found==null)return 2;byte[] bytes=new UTF8Encoding(false).GetBytes(found+"\n");using(var output=Console.OpenStandardOutput()){output.Write(bytes,0,bytes.Length);}return 0;}
      Uri uri;if(args.Length!=1||!Uri.TryCreate(args[0],UriKind.Absolute,out uri)||uri.Scheme!="classpet"||(uri.Host!="open"&&uri.Host!="ebooks"&&uri.Host!="launcher")||(uri.AbsolutePath!=""&&uri.AbsolutePath!="/")||uri.Query!=""||uri.Fragment!=""||uri.UserInfo!=""||!uri.IsDefaultPort)return 64;
      string config=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"folder.txt");
      string folder=File.Exists(config)?File.ReadAllText(config,Encoding.UTF8).Trim():null;
      string executable=Latest(folder);if(executable==null){string fallback=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"fallback.txt");if(File.Exists(fallback)){string candidate=File.ReadAllText(fallback,Encoding.UTF8).Trim();if(File.Exists(candidate)){executable=candidate;uri=new Uri("classpet://launcher");}}}if(executable==null)throw new Exception("找不到桌面小工具。請先執行新版桌面工具，並重新設定 EXE 所在資料夾。");
      Process.Start(new ProcessStartInfo {FileName=executable,Arguments="classpet://"+uri.Host,WorkingDirectory=Path.GetDirectoryName(executable),UseShellExecute=false});return 0;
    } catch(Exception error) {if(!probe)MessageBox.Show(error.Message,"班級寵物桌面啟動器",MessageBoxButtons.OK,MessageBoxIcon.Information);return 1;}
  }
}
