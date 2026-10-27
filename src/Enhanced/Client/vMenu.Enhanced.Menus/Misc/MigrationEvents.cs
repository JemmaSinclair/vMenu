using System;
using System.Linq;
using CitizenFX.FiveM.Client;
using vMenu.Enhanced.Logging;
using vMenu.Enhanced.Storage;

namespace vMenu.Enhanced.Menus.Misc;

/// <summary>
/// Handles incoming migration bundles from the vMenu stand-in migrator.
/// </summary>
public static class MigrationEvents
{
    public const string ImportBundleEvent = "vMenu.Enhanced:ImportMigrationBundle";

    public static void RegisterEventHandlers()
    {
        try
        {
            // Event handler for local client events: TriggerEvent("vMenu.Enhanced:ImportMigrationBundle", bundleJson)
            API.OnEvent(ImportBundleEvent, new Action<string>(bundleJson =>
            {
                try
                {
                    DataTransfer.ImportBundleRaw(bundleJson, out _, out _);
                }
                catch (Exception ex)
                {
                    Log.Error($"[Migration] Error processing ImportMigrationBundle event: {ex}");
                }
            }));
        }
        catch (Exception ex)
        {
            Log.Error($"[Migration] Failed to register OnEvent for {ImportBundleEvent}: {ex}");
        }

        try
        {
            // Client-side export: exports['vMenu.Enhanced']:ImportMigrationBundle(bundleJson)
            API.Exports.Local.Set("ImportMigrationBundle", new Func<string, object>(bundleJson =>
            {
                try
                {
                    var success = DataTransfer.ImportBundleRaw(bundleJson, out var appliedCount, out var errorMessage);
                    return new { success, appliedCount, error = errorMessage };
                }
                catch (Exception ex)
                {
                    Log.Error($"[Migration] Error in ImportMigrationBundle export: {ex}");
                    return new { success = false, appliedCount = 0, error = ex.Message };
                }
            }));
        }
        catch (Exception ex)
        {
            Log.Error($"[Migration] Failed to register ImportMigrationBundle export: {ex}");
        }

        try
        {
            // Client-side export: exports['vMenu.Enhanced']:GetExistingKeys()
            API.Exports.Local.Set("GetExistingKeys", new Func<object>(() =>
            {
                try
                {
                    return KvpStore.Keys(KvpStore.Prefix).ToArray();
                }
                catch (Exception ex)
                {
                    Log.Error($"[Migration] Error in GetExistingKeys export: {ex}");
                    return Array.Empty<string>();
                }
            }));
        }
        catch (Exception ex)
        {
            Log.Error($"[Migration] Failed to register GetExistingKeys export: {ex}");
        }

        try
        {
            // Client-side export to clear only vMenu.Enhanced data for testing
            API.Exports.Local.Set("ClearAllData", new Func<int>(() =>
            {
                try
                {
                    var keys = KvpStore.Keys(KvpStore.Prefix);
                    foreach (var key in keys)
                    {
                        KvpStore.Delete(key);
                    }
                    KvpStore.InvalidateCache();
                    Log.Info($"[Migration] Cleared {keys.Count} vMenu.Enhanced keys.");
                    return keys.Count;
                }
                catch (Exception ex)
                {
                    Log.Error($"[Migration] Error in ClearAllData export: {ex}");
                    return 0;
                }
            }));
        }
        catch (Exception ex)
        {
            Log.Error($"[Migration] Failed to register ClearAllData export: {ex}");
        }

        Log.Info("[Migration] vMenu Enhanced migration receiver registered successfully.");
    }
}
