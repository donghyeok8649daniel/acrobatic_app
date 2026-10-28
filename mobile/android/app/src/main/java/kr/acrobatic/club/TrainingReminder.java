package kr.acrobatic.club;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.Build;
import java.time.Instant;

public final class TrainingReminder extends BroadcastReceiver {
    private static final String CHANNEL="personal-training";
    public static boolean enabled(Context context) { return context.getSharedPreferences("app",0).getBoolean("reminders",false); }
    public static void setEnabled(Context context,boolean enabled) {
        context.getSharedPreferences("app",0).edit().putBoolean("reminders",enabled).apply();
        if(enabled) schedule(context); else ((AlarmManager)context.getSystemService(Context.ALARM_SERVICE)).cancel(intent(context));
    }
    private static PendingIntent intent(Context context) { return PendingIntent.getBroadcast(context,1,new Intent(context,TrainingReminder.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE); }
    public static void schedule(Context context) {
        if(!enabled(context))return;
        long next=AppPolicy.nextReminder(Instant.now()).toInstant().toEpochMilli();
        ((AlarmManager)context.getSystemService(Context.ALARM_SERVICE)).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,next,intent(context));
    }
    @Override public void onReceive(Context context,Intent intent) {
        if(!enabled(context))return;
        NotificationManager manager=context.getSystemService(NotificationManager.class);
        manager.createNotificationChannel(new NotificationChannel(CHANNEL,context.getString(R.string.reminder_title),NotificationManager.IMPORTANCE_DEFAULT));
        if(Build.VERSION.SDK_INT<33||context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED){
            PendingIntent open=PendingIntent.getActivity(context,2,new Intent(context,MainActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
            manager.notify(1,new Notification.Builder(context,CHANNEL).setSmallIcon(R.drawable.ic_training).setContentTitle(context.getString(R.string.reminder_title)).setContentText(context.getString(R.string.reminder_body)).setStyle(new Notification.BigTextStyle().bigText(context.getString(R.string.reminder_body))).setContentIntent(open).setAutoCancel(true).build());
        }
        schedule(context);
    }
}
