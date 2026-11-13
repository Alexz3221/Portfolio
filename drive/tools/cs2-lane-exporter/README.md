# CSLModernMap lane graph patch

`lane-graph.patch` adds a `cmm-v1` extension at
`extensions.cs2.lane_graph`. It exports car edge-lane curves, junction
connectors, native lane/entity identifiers, widths, direction spans, and
connection flags. Existing map fields remain intact.

This patch is against the [MIT-licensed CSLModernMap-CodeMod source](https://github.com/Liuiuera/CSLModernMap-CodeMod)
at commit `2a2b28e` (mod version 6.7.3f1). It is source code only; the game
save, raw export, and built DLL are kept outside this repository. See the
patch's `CS2/LANE_GRAPH_EXPORT.md` after applying it for the field details.

To reproduce the experimental build on a Windows PC with Cities: Skylines II
and the .NET 8 SDK:

```powershell
git clone https://github.com/Liuiuera/CSLModernMap-CodeMod.git
cd CSLModernMap-CodeMod
git checkout 2a2b28e
git apply C:\path\to\portfolio-repo\drive\tools\cs2-lane-exporter\lane-graph.patch
dotnet build CS2/StandaloneBuild.csproj -c Release
```

The official CS2 Modding Toolchain build remains the upstream supported
method. The standalone project compiles directly against this machine's game
assemblies and emits `CS2/bin/Release/net48/CSLModernMapCs2.dll`. It compiled
with zero warnings/errors on 2026-11-12. Shut down the game before testing a
replacement DLL and back up the existing installed DLL first. The local
Paradox Mods cache may replace a manually installed DLL on a later update.

After restarting and exporting the city, check the `.cmm.gz` without loading
the full city into memory:

```powershell
cd C:\path\to\portfolio-repo\drive
node scripts/inspect-lane-graph.cjs "C:\path\to\city.cmm.gz"
```

The first export of Obamna's America contained 27,363 edge lanes and 20,016
resolved road connectors, with no invalid curves or unmatched lane
references. The exporter reported 40,636 omitted node lanes that did not
resolve to two exported road edges; this needs a district-level audit before
claiming complete routing coverage.
