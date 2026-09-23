import { useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { API_BASE } from "./config";
import { api, getToken } from "./api";
import { colors, radius, spacing } from "./theme";
import { Field, Muted, PrimaryButton } from "./ui";

type PickedImage = {
  uri: string;
  name: string;
  type: string;
};

type FeedbackItem = {
  id: string;
  title: string;
  content: string;
  status: string;
  created_at: string;
};

export function FeedbackSection() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<PickedImage[]>([]);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<FeedbackItem[] | null>(null);

  async function loadHistory() {
    try {
      const rows = await api<FeedbackItem[]>("/api/feedback/mine");
      setHistory(rows);
    } catch {
      setHistory([]);
    }
  }

  function resetForm() {
    setTitle("");
    setContent("");
    setImages([]);
  }

  async function pickImages() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Cần quyền", "Cho phép truy cập ảnh để đính kèm ảnh chụp màn hình.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 8,
    });
    if (result.canceled) return;
    const next = result.assets.map((a, i) => {
      const ext = (a.uri.split(".").pop() || "jpg").split("?")[0];
      return {
        uri: a.uri,
        name: a.fileName || `screenshot_${Date.now()}_${i}.${ext}`,
        type: a.mimeType || "image/jpeg",
      };
    });
    setImages((prev) => [...prev, ...next].slice(0, 8));
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Cần quyền", "Cho phép camera để chụp ảnh màn hình / hiện trường.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    const a = result.assets[0];
    const ext = (a.uri.split(".").pop() || "jpg").split("?")[0];
    setImages((prev) =>
      [
        ...prev,
        {
          uri: a.uri,
          name: a.fileName || `photo_${Date.now()}.${ext}`,
          type: a.mimeType || "image/jpeg",
        },
      ].slice(0, 8),
    );
  }

  async function submit() {
    if (!title.trim() || !content.trim()) {
      Alert.alert("Thiếu thông tin", "Nhập tiêu đề và nội dung góp ý.");
      return;
    }
    setSending(true);
    try {
      const form = new FormData();
      form.append("title", title.trim());
      form.append("content", content.trim());
      for (const img of images) {
        form.append("files", {
          uri: img.uri,
          name: img.name,
          type: img.type,
        } as unknown as Blob);
      }
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/feedback`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      if (!res.ok) {
        let detail = res.statusText;
        try {
          const data = await res.json();
          detail = data.detail || detail;
        } catch {
          /* ignore */
        }
        throw new Error(typeof detail === "string" ? detail : "Gửi thất bại");
      }
      Alert.alert("Đã gửi", "Góp ý của bạn đã được gửi tới quản trị.");
      resetForm();
      setOpen(false);
      loadHistory();
    } catch (e) {
      Alert.alert("Lỗi", e instanceof Error ? e.message : "Không gửi được góp ý");
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={{ marginTop: spacing.md }}>
      <PrimaryButton
        label="Góp ý"
        variant="ghost"
        onPress={() => {
          setOpen(true);
          if (history === null) loadHistory();
        }}
      />

      {history && history.length > 0 ? (
        <View style={{ marginTop: spacing.md }}>
          <Muted style={{ marginBottom: spacing.sm }}>Góp ý gần đây</Muted>
          {history.slice(0, 3).map((item) => (
            <View
              key={item.id}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.sm,
                padding: spacing.md,
                marginBottom: spacing.sm,
                backgroundColor: colors.surfaceSoft,
              }}
            >
              <Text style={{ fontWeight: "700", color: colors.text }}>{item.title}</Text>
              <Muted style={{ marginTop: 4 }}>{item.content.slice(0, 80)}{item.content.length > 80 ? "…" : ""}</Muted>
              <Muted style={{ marginTop: 6 }}>
                {item.status === "done" ? "Đã xử lý" : "Mới"} ·{" "}
                {new Date(item.created_at).toLocaleDateString("vi-VN")}
              </Muted>
            </View>
          ))}
        </View>
      ) : null}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(10,40,42,0.45)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: colors.bg,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              maxHeight: "92%",
              padding: spacing.lg,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: spacing.md }}>
              Gửi góp ý
            </Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Muted style={{ marginBottom: 6 }}>Tiêu đề</Muted>
              <Field
                value={title}
                onChangeText={setTitle}
                placeholder="Ví dụ: Lỗi hiển thị hóa đơn"
                style={{ marginBottom: spacing.md }}
              />
              <Muted style={{ marginBottom: 6 }}>Nội dung</Muted>
              <Field
                value={content}
                onChangeText={setContent}
                placeholder="Mô tả chi tiết góp ý hoặc sự cố..."
                multiline
                style={{ minHeight: 110, textAlignVertical: "top", marginBottom: spacing.md }}
              />
              <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }}>
                <PrimaryButton label="Chọn ảnh" variant="ghost" onPress={pickImages} style={{ flex: 1 }} />
                <PrimaryButton label="Chụp ảnh" variant="ghost" onPress={takePhoto} style={{ flex: 1 }} />
              </View>
              {images.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
                  {images.map((img, idx) => (
                    <View key={`${img.uri}-${idx}`} style={{ marginRight: spacing.sm }}>
                      <Image
                        source={{ uri: img.uri }}
                        style={{ width: 72, height: 72, borderRadius: radius.sm }}
                      />
                      <Pressable
                        onPress={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                        style={{ position: "absolute", top: -4, right: -4, backgroundColor: colors.bgDeep, borderRadius: 10, paddingHorizontal: 6 }}
                      >
                        <Text style={{ color: colors.white, fontSize: 12, fontWeight: "700" }}>×</Text>
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <Muted style={{ marginBottom: spacing.md }}>Có thể đính kèm tối đa 8 ảnh</Muted>
              )}
              <PrimaryButton label={sending ? "Đang gửi..." : "Gửi góp ý"} onPress={submit} disabled={sending} />
              <PrimaryButton
                label="Đóng"
                variant="dark"
                onPress={() => setOpen(false)}
                style={{ marginTop: spacing.sm }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
