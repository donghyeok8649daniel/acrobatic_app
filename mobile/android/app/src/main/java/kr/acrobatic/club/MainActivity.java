package kr.acrobatic.club;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import java.nio.charset.StandardCharsets;
import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;

public final class MainActivity extends ComponentActivity {
    private WebView team,guide;
    private LinearLayout error;
    private ProgressBar progress;
    private ValueCallback<Uri[]> photoResult;
    private static final int PHOTO=101,NOTIFICATIONS=102;
    private boolean showingGuide=false;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(Color.WHITE);
        if(Build.VERSION.SDK_INT>=30)root.setOnApplyWindowInsetsListener((v,insets)->{android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.ime());v.setPadding(bars.left,bars.top,bars.right,bars.bottom);return WindowInsets.CONSUMED;});
        if(Build.VERSION.SDK_INT<30)root.setOnApplyWindowInsetsListener((v,insets)->{v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets.consumeSystemWindowInsets();});
        LinearLayout toolbar=new LinearLayout(this);toolbar.setGravity(Gravity.CENTER_VERTICAL);toolbar.setPadding(dp(12),0,dp(8),0);
        TextView title=new TextView(this);title.setText("ACROBATIC");title.setTextColor(Color.rgb(29,44,59));title.setTextSize(16);title.setTypeface(null,android.graphics.Typeface.BOLD);
        toolbar.addView(title,new LinearLayout.LayoutParams(0,dp(54),1));title.setGravity(Gravity.CENTER_VERTICAL);
        Button manual=button(getString(R.string.guide));manual.setId(R.id.open_manual);manual.setOnClickListener(v->{if(showingGuide)closeGuide();else openGuide();});toolbar.addView(manual);
        Button more=button("⋮");more.setId(R.id.app_settings);more.setContentDescription(getString(R.string.more));more.setOnClickListener(v->settings());toolbar.addView(more,new LinearLayout.LayoutParams(dp(48),dp(48)));
        root.addView(toolbar);progress=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);root.addView(progress,new LinearLayout.LayoutParams(-1,dp(2)));
        FrameLayout content=new FrameLayout(this);root.addView(content,new LinearLayout.LayoutParams(-1,0,1));
        team=new WebView(this);team.setId(R.id.team_webview);configure(team,true);content.addView(team,new FrameLayout.LayoutParams(-1,-1));
        guide=new WebView(this);guide.setId(R.id.offline_guide);configure(guide,false);guide.setVisibility(View.GONE);content.addView(guide,new FrameLayout.LayoutParams(-1,-1));
        error=new LinearLayout(this);error.setOrientation(LinearLayout.VERTICAL);error.setGravity(Gravity.CENTER);error.setPadding(dp(30),dp(24),dp(30),dp(24));error.setBackgroundColor(Color.WHITE);error.setVisibility(View.GONE);
        TextView errorText=new TextView(this);errorText.setText(R.string.offline);errorText.setTextSize(16);errorText.setGravity(Gravity.CENTER);error.addView(errorText);
        Button retry=button(getString(R.string.retry));retry.setOnClickListener(v->reload());error.addView(retry);Button offline=button(getString(R.string.guide));offline.setOnClickListener(v->openGuide());error.addView(offline);content.addView(error,new FrameLayout.LayoutParams(-1,-1));
        team.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest req){String url=req.getUrl().toString();if(AppPolicy.isTeamUrl(url))return false;if(req.isForMainFrame())openExternal(url);return true;}
            @Override public void onPageFinished(WebView view,String url){CookieManager.getInstance().flush();}
            @Override public void onReceivedError(WebView view,WebResourceRequest req,WebResourceError e){if(req.isForMainFrame()&&!showingGuide)error.setVisibility(View.VISIBLE);}
            @Override public void onReceivedHttpError(WebView view,WebResourceRequest req,WebResourceResponse response){if(req.isForMainFrame()&&response.getStatusCode()>=500&&!showingGuide)error.setVisibility(View.VISIBLE);}
        });
        team.setWebChromeClient(new WebChromeClient(){
            @Override public void onProgressChanged(WebView view,int value){progress.setProgress(value);progress.setVisibility(value<100?View.VISIBLE:View.INVISIBLE);}
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> result,FileChooserParams params){if(!AppPolicy.isTeamUrl(view.getUrl()))return false;if(photoResult!=null)photoResult.onReceiveValue(null);photoResult=result;Intent choose=new Intent(Intent.ACTION_OPEN_DOCUMENT);choose.addCategory(Intent.CATEGORY_OPENABLE);boolean video=false;for(String type:params.getAcceptTypes())if(type.startsWith("video/"))video=true;choose.setType(video?"video/*":"image/*");try{startActivityForResult(Intent.createChooser(choose,getString(R.string.select_photo)),PHOTO);}catch(ActivityNotFoundException e){photoResult.onReceiveValue(null);photoResult=null;toast(R.string.external_error);}return true;}
            @Override public boolean onJsAlert(WebView view,String url,String message,JsResult result){new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton(android.R.string.ok,(d,w)->result.confirm()).setOnCancelListener(d->result.cancel()).show();return true;}
            @Override public boolean onJsConfirm(WebView view,String url,String message,JsResult result){new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton(android.R.string.ok,(d,w)->result.confirm()).setNegativeButton(android.R.string.cancel,(d,w)->result.cancel()).setOnCancelListener(d->result.cancel()).show();return true;}
        });
        team.setDownloadListener((url,ua,disposition,mime,size)->openExternal(url));
        setContentView(root);getOnBackPressedDispatcher().addCallback(this,new OnBackPressedCallback(true){@Override public void handleOnBackPressed(){back();}});
        if(state==null||team.restoreState(state)==null)team.loadUrl(AppPolicy.APP_URL);
    }
    @android.annotation.SuppressLint("SetJavaScriptEnabled")
    private void configure(WebView view,boolean online){WebSettings s=view.getSettings();s.setJavaScriptEnabled(online);s.setDomStorageEnabled(online);s.setAllowFileAccess(false);s.setAllowContentAccess(online);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setMediaPlaybackRequiresUserGesture(true);s.setUserAgentString(s.getUserAgentString()+" AcrobaticAndroid/"+BuildConfig.VERSION_NAME);CookieManager.getInstance().setAcceptThirdPartyCookies(view,false);}
    private Button button(String label){Button b=new Button(this);b.setText(label);b.setTextSize(12);b.setAllCaps(false);b.setMinHeight(dp(48));b.setMinimumHeight(dp(48));return b;}
    private int dp(int value){return (int)(value*getResources().getDisplayMetrics().density+.5f);}
    private void reload(){closeGuide();error.setVisibility(View.GONE);if(AppPolicy.isTeamUrl(team.getUrl()))team.reload();else team.loadUrl(AppPolicy.APP_URL);}
    private void openGuide(){try{String html;try(java.io.InputStream in=getAssets().open("manuals.html");java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream()){byte[] buffer=new byte[4096];for(int n;(n=in.read(buffer))!=-1;)out.write(buffer,0,n);html=out.toString(StandardCharsets.UTF_8.name());}guide.loadDataWithBaseURL("https://offline.acrobatic.invalid/",html,"text/html","UTF-8",null);team.setVisibility(View.GONE);error.setVisibility(View.GONE);guide.setVisibility(View.VISIBLE);showingGuide=true;}catch(Exception e){toast(R.string.external_error);}}
    private void closeGuide(){guide.setVisibility(View.GONE);team.setVisibility(View.VISIBLE);showingGuide=false;}
    private void settings(){String reminder=getString(TrainingReminder.enabled(this)?R.string.reminder_off:R.string.reminder_on);new AlertDialog.Builder(this).setTitle("Acrobatic "+BuildConfig.VERSION_NAME).setItems(new String[]{getString(R.string.reload),getString(R.string.guide),reminder,getString(R.string.share),getString(R.string.update)},(d,index)->{switch(index){case 0:reload();break;case 1:openGuide();break;case 2:toggleReminder();break;case 3:Intent share=new Intent(Intent.ACTION_SEND);share.setType("text/plain");share.putExtra(Intent.EXTRA_TEXT,"KAIST Acrobatic\n"+AppPolicy.UPDATES);startActivity(Intent.createChooser(share,getString(R.string.share)));break;case 4:openExternal(AppPolicy.UPDATES);break;}}).setNegativeButton(R.string.close,null).show();}
    private void toggleReminder(){if(TrainingReminder.enabled(this)){TrainingReminder.setEnabled(this,false);toast(R.string.reminder_stopped);return;}if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},NOTIFICATIONS);return;}TrainingReminder.setEnabled(this,true);toast(R.string.reminder_ready);}
    @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] grants){super.onRequestPermissionsResult(request,permissions,grants);if(request==NOTIFICATIONS){if(grants.length>0&&grants[0]==PackageManager.PERMISSION_GRANTED){TrainingReminder.setEnabled(this,true);toast(R.string.reminder_ready);}else toast(R.string.permission_needed);}}
    private void openExternal(String url){if(!AppPolicy.isExternalUrl(url))return;new AlertDialog.Builder(this).setTitle(R.string.leave_title).setMessage(Uri.parse(url).getHost()).setPositiveButton(R.string.open,(d,w)->{try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)));}catch(ActivityNotFoundException e){toast(R.string.external_error);}}).setNegativeButton(android.R.string.cancel,null).show();}
    private void toast(int string){Toast.makeText(this,string,Toast.LENGTH_LONG).show();}
    private void back(){if(showingGuide){closeGuide();return;}if(team.canGoBack())team.goBack();else finish();}
    @Override protected void onSaveInstanceState(Bundle state){team.saveState(state);super.onSaveInstanceState(state);}
    @Override protected void onPause(){super.onPause();team.onPause();CookieManager.getInstance().flush();}
    @Override protected void onResume(){super.onResume();if(team!=null)team.onResume();}
    @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==PHOTO&&photoResult!=null){Uri uri=result==RESULT_OK&&data!=null?data.getData():null;photoResult.onReceiveValue(uri!=null&&"content".equals(uri.getScheme())?new Uri[]{uri}:null);photoResult=null;}}
    @Override protected void onDestroy(){if(photoResult!=null)photoResult.onReceiveValue(null);team.destroy();guide.destroy();super.onDestroy();}
}
