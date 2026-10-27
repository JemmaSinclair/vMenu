using System;
using System.Collections.Generic;
using System.Linq;
using CitizenFX.Core;
using CitizenFX.Core.Native;
using vMenu.Enhanced.Logging;
using vMenu.Enhanced.Storage;
using vMenu.Legacy.Hosting;

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
            Script.EventHandlers[ImportBundleEvent] += new Action<string>(bundleJson =>
            {
                try
                {
                    DataTransfer.ImportBundleRaw(bundleJson, out _, out _);
                }
                catch (Exception ex)
                {
                    Log.Error($"[Migration] Error processing ImportMigrationBundle event: {ex}");
                }
            });
        }
        catch (Exception ex)
        {
            Log.Error($"[Migration] Failed to register EventHandlers for {ImportBundleEvent}: {ex}");
        }

        try
        {
            Script.Exports.Add("ImportMigrationBundle", new Func<string, object>(bundleJson =>
            {
                try
                {
                    var success = DataTransfer.ImportBundleRaw(bundleJson, out var appliedCount, out var errorMessage);
                    return new Dictionary<string, object>
                    {
                        ["success"] = success,
                        ["appliedCount"] = appliedCount,
                        ["error"] = errorMessage ?? ""
                    };
                }
                catch (Exception ex)
                {
                    Log.Error($"[Migration] Error in ImportMigrationBundle export: {ex}");
                    return new Dictionary<string, object>
                    {
                        ["success"] = false,
                        ["appliedCount"] = 0,
                        ["error"] = ex.Message
                    };
                }
            }));
        }
        catch (Exception ex)
        {
            Log.Error($"[Migration] Failed to register ImportMigrationBundle export: {ex}");
        }

        try
        {
            Script.Exports.Add("GetExistingKeys", new Func<object>(() =>
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
            Script.Exports.Add("ClearAllData", new Func<int>(() =>
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
