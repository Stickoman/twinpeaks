"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Phone, Car, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface DriverProfile {
  id: string;
  username: string;
  phone: string | null;
  vehicle_info: string | null;
}

async function fetchProfile(): Promise<DriverProfile> {
  const res = await fetch("/api/driver/profile");
  if (!res.ok) throw new Error("Failed to load profile");
  return res.json() as Promise<DriverProfile>;
}

async function updateProfile(data: {
  phone?: string;
  vehicle_info?: string;
}): Promise<DriverProfile> {
  const res = await fetch("/api/driver/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update profile");
  return res.json() as Promise<DriverProfile>;
}

async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login";
}

export default function DriverProfilePage() {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState("");
  const [vehicleInfo, setVehicleInfo] = useState("");
  const [initialized, setInitialized] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["driver-profile"],
    queryFn: fetchProfile,
  });

  if (profile && !initialized) {
    setPhone(profile.phone ?? "");
    setVehicleInfo(profile.vehicle_info ?? "");
    setInitialized(true);
  }

  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["driver-profile"] });
      toast.success("Profile updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSave = () => {
    mutation.mutate({
      phone: phone || undefined,
      vehicle_info: vehicleInfo || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Profile</h2>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="size-4" />
            {profile?.username}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="size-3.5" />
              Phone Number
            </Label>
            <Input
              id="phone"
              placeholder="(555) 123-4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vehicle" className="flex items-center gap-2">
              <Car className="size-3.5" />
              Vehicle Info
            </Label>
            <Input
              id="vehicle"
              placeholder="e.g. Black Honda Civic 2022"
              value={vehicleInfo}
              onChange={(e) => setVehicleInfo(e.target.value)}
            />
          </div>

          <Button onClick={handleSave} disabled={mutation.isPending} className="w-full">
            {mutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      <Button variant="destructive" className="w-full" onClick={() => logout()}>
        <LogOut className="size-4" />
        Sign Out
      </Button>
    </div>
  );
}
