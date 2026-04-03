import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  Alert,
  Platform,
  Dimensions,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import {
  Tag,
  Save,
  Trash2,
  Watch,
  Signal,
  RefreshCw,
  Layers,
  History,
  PlayCircle,
  StopCircle,
  ArrowUpRight,
} from "lucide-react-native";

import { useReaderScan } from "../../../reader/ble/hooks/use-reader-scan";
import { useReaderStore } from "../../../reader/ble/store/reader.store";

import { useScanSessionStore } from "../../store/scan-session.store";
import { useTagCacheStore } from "../../store/tag-cache.store";
import { inventoryApi } from "../../api/sessions";

const { width } = Dimensions.get("window");

export function InventoryScanScreen() {
  const { isScanning, startScan, stopScan } = useReaderScan();
  const { status } = useReaderStore();

  const { scannedTags, startNewSession, saveToStorage, clearAll } =
    useScanSessionStore();

  const { serverNames, getName, renameTag, updateServerNames } = useTagCacheStore();

  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [lastScanAt, setLastScanAt] = useState<number | null>(null);

  useEffect(() => {
    // Chỉ stop scan khi thoát màn hình, không tự động start
    return () => {
      stopScan().catch(() => { });
    };
  }, []);

  useEffect(() => {
    if (isScanning) {
      const mappedTags = Object.values(scannedTags)
        .filter((t) => t.isPresent)
        .map((t) => ({ epc: t.epc, rssi: t.rssi }));

      if (mappedTags.length > 0) {
        setLastScanAt(Date.now());
        inventoryApi.pushLiveScan(mappedTags).catch(() => { });
      }
    }
  }, [scannedTags, isScanning]);

  const displayList = Object.values(scannedTags)
    .map((t) => ({ ...t, displayName: serverNames[t.epc] || 'Thẻ chưa có tên' }))
    .sort(
      (a, b) =>
        new Date(b.lastScanTime).getTime() - new Date(a.lastScanTime).getTime(),
    );

  const handleNewSession = () => {
    Alert.alert("Phiên mới", "Xóa tất cả tag đã quét và bắt đầu phiên mới?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa & bắt đầu",
        style: "destructive",
        onPress: () => {
          clearAll();
          setLastSyncedAt(null);
          setLastScanAt(null);
        },
      },
    ]);
  };

  const handleEndSession = async () => {
    if (isScanning) {
      Alert.alert(
        "Chưa thể lưu",
        "Vui lòng dừng quét (Bóp cò hoặc nhấn nút DỪNG QUÉT) trước khi lưu phiên.",
      );
      return;
    }

    const mappedTags = Object.values(scannedTags)
      .filter((t) => t.isPresent)
      .map((t) => ({
        epc: t.epc,
        rssi: t.rssi,
        time: new Date(t.lastScanTime).toISOString(),
      }));

    if (mappedTags.length === 0) {
      Alert.alert(
        "Thống báo",
        "Chưa có thẻ nào được quét trong phiên này để lưu.",
      );
      return;
    }

    if (hasPendingSync) {
      Alert.alert(
        "Cần đồng bộ trước khi lưu",
        "Bạn phải bấm nút \"Đồng bộ\" để đồng bộ dữ liệu trước khi lưu phiên quét.",
      );
      return;
    }

    Alert.alert(
      "Lưu phiên kiểm kê",
      `Bạn có chắc muốn kết thúc phiên và đẩy ${mappedTags.length} thẻ lên hệ thống?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Lưu & Kết thúc",
          style: "default",
          onPress: async () => {
            setIsSaving(true);
            try {
              const now = new Date();
              const m = now.getMinutes().toString().padStart(2, "0");
              const sessionName = `Ca kiểm kê ${now.getHours()}h${m} ngày ${now.getDate()}/${now.getMonth() + 1}`;

              const session: any = await inventoryApi.pushSession({
                name: sessionName,
                scans: mappedTags as any,
              });

              Alert.alert(
                "Thành công",
                "Đã lưu phiên kiểm kê và đồng bộ lên server.",
                [{
                  text: "OK",
                  onPress: () => {
                    clearAll();
                    setLastSyncedAt(null);
                    setLastScanAt(null);
                  },
                }],
              );
            } catch (e: any) {
              Alert.alert(
                "Lỗi lưu phiên",
                e.message || "Không thể kết nối đến máy chủ.",
              );
            } finally {
              setIsSaving(false);
            }
          },
        },
      ],
    );
  };

  const syncTags = async () => {
    setIsSyncing(true);
    try {
      const serverNames = await inventoryApi.pullTags();
      const serverEpcs = Object.keys(serverNames);
      const scannedEpcs = Object.keys(scannedTags);

      // Debug: so sánh format EPC
      if (scannedEpcs.length > 0 && serverEpcs.length > 0) {
        console.log('[Sync Debug] Scanned EPC sample:', JSON.stringify(scannedEpcs[0]));
        console.log('[Sync Debug] Server EPC sample:', JSON.stringify(serverEpcs[0]));
      }

      // Đếm số thẻ khớp
      const matched = scannedEpcs.filter(epc => serverNames[epc]);
      console.log(`[Sync] Server: ${serverEpcs.length} | Scanned: ${scannedEpcs.length} | Matched: ${matched.length}`);

      updateServerNames(serverNames);
      setLastSyncedAt(Date.now());

      const matchInfo = scannedEpcs.length > 0
        ? `\n${matched.length}/${scannedEpcs.length} thẻ đã quét được nhận diện.`
        : '';

      Alert.alert(
        'Đồng bộ thành công',
        `Đã tải ${serverEpcs.length} thẻ từ hệ thống.${matchInfo}`,
      );
    } catch (e: any) {
      console.error("[Sync Error]", e);
      Alert.alert(
        "Không thể làm mới dữ liệu",
        e.message ||
        "Đã có lỗi kết nối lên máy chủ. Vui lòng kiểm tra lại mạng hoặc thử lại sau.",
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const getTimeAgo = (date: string | Date) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return "long ago";
  };

  const presentCount = displayList.filter((t) => t.isPresent).length;
  const hasPendingSync =
    presentCount > 0 &&
    (!lastSyncedAt || (lastScanAt !== null && lastSyncedAt < lastScanAt));

  const handleToggleScan = () => {
    if (isScanning) {
      stopScan().catch(() => { });
    } else {
      startScan().catch(() => { });
      Alert.alert(
        "Sẵn sàng quét",
        "Vui lòng bóp cò thiết bị RFID để đọc thẻ. Nếu đã bóp cò, vui lòng bấm Đóng.",
        [{ text: "Đóng", style: "default" }],
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Connection Bar */}
        <View style={styles.connBar}>
          <View style={styles.connStatus}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    status === "connected" ? "#10B981" : "#EF4444",
                },
              ]}
            />
            <Text style={styles.statusText}>
              {status === "connected" ? "READER ONLINE" : "DISCONNECTED"}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.syncBtn, hasPendingSync && styles.syncBtnWarning]}
            onPress={syncTags}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color={hasPendingSync ? "#B45309" : "#64748B"} />
            ) : (
              <RefreshCw size={16} color={hasPendingSync ? "#B45309" : "#64748B"} />
            )}
            <Text style={[styles.syncBtnText, hasPendingSync && styles.syncBtnTextWarning]}>
              {isSyncing ? "Đang đồng bộ" : "Đồng bộ"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Counter Hero Section */}
        <View style={styles.heroBox}>
          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <View style={styles.heroIconBox}>
                <Layers color="#4F46E5" size={24} />
              </View>
              <View style={styles.heroMeta}>
                <Text style={styles.heroLabel}>TỔNG SỐ THẺ QUÉT ĐƯỢC</Text>
                <Text style={styles.heroSublabel}>Live UHF Scanning</Text>
              </View>
            </View>

            <View style={styles.counterRow}>
              <Text style={styles.counterValue}>{presentCount}</Text>
              <Text style={styles.counterUnit}>thẻ</Text>
            </View>

            <View style={styles.heroFooter}>
              <View
                style={[
                  styles.liveBadge,
                  { backgroundColor: isScanning ? "#ECFDF5" : "#F8FAFC" },
                ]}
              >
                <View
                  style={[
                    styles.liveDot,
                    { backgroundColor: isScanning ? "#10B981" : "#CBD5E1" },
                  ]}
                />
                <Text
                  style={[
                    styles.liveText,
                    { color: isScanning ? "#059669" : "#64748B" },
                  ]}
                >
                  {isScanning ? "ĐANG QUÉT" : "TẠM DỪNG"}
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 16 }}>
                <TouchableOpacity
                  onPress={handleNewSession}
                  style={styles.clearBtn}
                  disabled={isSaving}
                >
                  <History color="#64748B" size={16} />
                  <Text style={styles.clearText}>Làm mới</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleEndSession}
                  style={styles.clearBtn}
                  disabled={isSaving || isSyncing || hasPendingSync}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#4F46E5" />
                  ) : hasPendingSync ? (
                    <RefreshCw color="#F59E0B" size={16} />
                  ) : (
                    <Save color="#4F46E5" size={16} />
                  )}
                  <Text style={[styles.clearText, { color: "#4F46E5" }]}>
                    {isSaving ? "Đang lưu..." : hasPendingSync ? "Cần đồng bộ" : "Lưu phiên"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Action Button */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={[styles.startBtn, isScanning && styles.startBtnActive]}
            onPress={handleToggleScan}
          >
            {isScanning ? (
              <StopCircle color="#FFFFFF" size={24} />
            ) : (
              <PlayCircle color="#FFFFFF" size={24} />
            )}
            <Text style={styles.startBtnText}>
              {isScanning ? "DỪNG QUÉT RFID" : "BẮT ĐẦU KIỂM KÊ"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content Section */}
        <View style={styles.contentHeader}>
          <Text style={styles.contentTitle}>THIẾT BỊ GẦN ĐÂY</Text>
        </View>

        <FlatList
          data={displayList}
          keyExtractor={(item) => item.epc}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.tagCard, !item.isPresent && styles.tagCardDim]}
              onLongPress={() => {
                setSelectedTag(item.epc);
                setNewName(item.displayName);
                setIsModalVisible(true);
              }}
            >
              <View style={styles.tagIconHolder}>
                <Tag size={20} color="#4F46E5" />
              </View>

              <View style={styles.tagInfo}>
                <Text style={styles.tagTitle} numberOfLines={1}>
                  {item.displayName}
                </Text>
                <Text style={styles.tagEpc}>
                  {item.epc.substring(0, 16)}...
                </Text>
              </View>

              <View style={styles.tagRight}>
                <View style={styles.tagSignal}>
                  <Signal
                    size={12}
                    color={item.rssi > -60 ? "#10B981" : "#F59E0B"}
                  />
                  <Text
                    style={[
                      styles.tagRssi,
                      { color: item.rssi > -60 ? "#059669" : "#B45309" },
                    ]}
                  >
                    {item.rssi}
                  </Text>
                </View>
                <Text style={styles.tagTime}>
                  {getTimeAgo(item.lastScanTime)}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Layers color="#E2E8F0" size={48} />
              <Text style={styles.emptyTitle}>
                {status !== "connected"
                  ? "Vui lòng kết nối RFID Reader"
                  : "Chưa tìm thấy thẻ nào"}
              </Text>
            </View>
          }
        />

        {/* Rename Modal */}
        <Modal visible={isModalVisible} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <View style={styles.modalBody}>
              <Text style={styles.modalTitle}>Đổi tên sản phẩm</Text>
              <Text style={styles.modalSubtitle}>
                Định danh cho thẻ RFID này
              </Text>

              <TextInput
                style={styles.modalInput}
                value={newName}
                onChangeText={setNewName}
                placeholder="Nhập tên sản phẩm..."
                placeholderTextColor="#94A3B8"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalBtnCancel}
                  onPress={() => setIsModalVisible(false)}
                >
                  <Text style={styles.modalBtnCancelText}>Bỏ qua</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalBtnSave}
                  onPress={() => {
                    if (selectedTag && newName.trim()) {
                      renameTag(selectedTag, newName.trim());
                      setIsModalVisible(false);
                    }
                  }}
                >
                  <Text style={styles.modalBtnSaveText}>Lưu định danh</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F9FB" },
  container: { flex: 1 },

  connBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  connStatus: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  syncBtn: {
    height: 36,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 10,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  syncBtnWarning: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FED7AA",
  },
  syncBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 0.2,
  },
  syncBtnTextWarning: {
    color: "#B45309",
  },

  heroBox: { paddingHorizontal: 20, paddingBottom: 20 },
  heroCard: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  heroTop: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  heroIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  heroMeta: { flex: 1 },
  heroLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 1,
  },
  heroSublabel: { fontSize: 12, color: "#64748B", marginTop: 2 },

  counterRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 24,
    justifyContent: "center",
  },
  counterValue: { fontSize: 64, fontWeight: "bold", color: "#1E293B" },
  counterUnit: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#94A3B8",
    marginLeft: 8,
  },

  heroFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F8FAFC",
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
  liveText: { fontSize: 11, fontWeight: "800" },
  clearBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  clearText: { fontSize: 13, fontWeight: "600", color: "#64748B" },

  actionSection: { paddingHorizontal: 20, marginBottom: 24 },
  startBtn: {
    backgroundColor: "#4F46E5",
    height: 60,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  startBtnActive: { backgroundColor: "#EF4444", shadowColor: "#EF4444" },
  startBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 1,
  },

  contentHeader: { paddingHorizontal: 24, marginBottom: 12 },
  contentTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 1,
  },

  listContent: { paddingHorizontal: 20, paddingBottom: 20 },
  tagCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  tagCardDim: { opacity: 0.5 },
  tagIconHolder: {
    width: 44,
    height: 44,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  tagInfo: { flex: 1 },
  tagTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 2,
  },
  tagEpc: {
    fontSize: 11,
    color: "#94A3B8",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  tagRight: { alignItems: "flex-end", gap: 4 },
  tagSignal: { flexDirection: "row", alignItems: "center", gap: 4 },
  tagRssi: { fontSize: 13, fontWeight: "800" },
  tagTime: { fontSize: 10, color: "#94A3B8", fontWeight: "500" },

  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 40,
  },
  emptyTitle: {
    color: "#94A3B8",
    fontSize: 14,
    textAlign: "center",
    marginTop: 12,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    padding: 24,
  },
  modalBody: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 4,
  },
  modalSubtitle: { fontSize: 14, color: "#64748B", marginBottom: 20 },
  modalInput: {
    backgroundColor: "#F8FAFC",
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    color: "#1E293B",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 24,
  },
  modalActions: { flexDirection: "row", gap: 12 },
  modalBtnCancel: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  modalBtnCancelText: { color: "#64748B", fontWeight: "bold" },
  modalBtnSave: {
    flex: 2,
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4F46E5",
  },
  modalBtnSaveText: { color: "#FFFFFF", fontWeight: "bold" },
});
