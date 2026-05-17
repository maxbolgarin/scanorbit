package pricing

import (
	"math"
	"testing"
)

func TestGetEC2Cost_Known(t *testing.T) {
	tests := []struct {
		instanceType string
		want         float64
	}{
		{"t3.micro", 7.59},
		{"m5.large", 70.08},
		{"c5.xlarge", 124.10},
		{"r5.large", 91.98},
	}

	for _, tt := range tests {
		got := GetEC2Cost(tt.instanceType)
		if got != tt.want {
			t.Errorf("GetEC2Cost(%q) = %v, want %v", tt.instanceType, got, tt.want)
		}
	}
}

func TestGetEC2Cost_Unknown(t *testing.T) {
	if got := GetEC2Cost("x99.mega"); got != 0 {
		t.Errorf("expected 0 for unknown type, got %v", got)
	}
}

func TestGetEBSCost_Known(t *testing.T) {
	tests := []struct {
		volumeType string
		sizeGB     int
		want       float64
	}{
		{"gp2", 100, 10.0},
		{"gp3", 100, 8.0},
		{"io1", 50, 6.25},
		{"sc1", 1000, 15.0},
	}

	for _, tt := range tests {
		got := GetEBSCost(tt.volumeType, tt.sizeGB)
		if math.Abs(got-tt.want) > 0.01 {
			t.Errorf("GetEBSCost(%q, %d) = %v, want %v", tt.volumeType, tt.sizeGB, got, tt.want)
		}
	}
}

func TestGetEBSCost_UnknownDefaultsToGP2(t *testing.T) {
	got := GetEBSCost("unknown", 100)
	if math.Abs(got-10.0) > 0.01 {
		t.Errorf("expected default gp2 pricing (10.0), got %v", got)
	}
}

func TestGetRDSCost_Known(t *testing.T) {
	got := GetRDSCost("db.t3.medium", false)
	if got != 49.64 {
		t.Errorf("GetRDSCost(db.t3.medium, false) = %v, want 49.64", got)
	}
}

func TestGetRDSCost_MultiAZ(t *testing.T) {
	got := GetRDSCost("db.t3.medium", true)
	want := 49.64 * 2
	if math.Abs(got-want) > 0.01 {
		t.Errorf("GetRDSCost(db.t3.medium, true) = %v, want %v", got, want)
	}
}

func TestGetRDSCost_Unknown(t *testing.T) {
	got := GetRDSCost("db.unknown.large", false)
	if got != 50.0 {
		t.Errorf("expected default 50.0 for unknown type, got %v", got)
	}
}

func TestGetRDSSnapshotCost(t *testing.T) {
	got := GetRDSSnapshotCost(100)
	want := 9.5
	if math.Abs(got-want) > 0.01 {
		t.Errorf("GetRDSSnapshotCost(100) = %v, want %v", got, want)
	}
}

func TestGetCloudWatchLogsCost(t *testing.T) {
	oneGB := int64(1024 * 1024 * 1024)
	got := GetCloudWatchLogsCost(oneGB)
	if math.Abs(got-CloudWatchLogsStoragePerGB) > 0.001 {
		t.Errorf("GetCloudWatchLogsCost(1GB) = %v, want %v", got, CloudWatchLogsStoragePerGB)
	}
}

func TestLambdaEstimateCost(t *testing.T) {
	got := LambdaEstimateCost(128)
	if got <= 0 {
		t.Errorf("expected positive cost, got %v", got)
	}

	// Larger memory should cost more
	gotLarge := LambdaEstimateCost(1024)
	if gotLarge <= got {
		t.Errorf("1024MB (%v) should cost more than 128MB (%v)", gotLarge, got)
	}
}

func TestConstants(t *testing.T) {
	// Verify key constants are set to expected values
	if EIPUnattachedCost != 3.65 {
		t.Errorf("EIPUnattachedCost = %v, want 3.65", EIPUnattachedCost)
	}
	if ALBBaseCost != 16.43 {
		t.Errorf("ALBBaseCost = %v, want 16.43", ALBBaseCost)
	}
	if KMSKeyPerMonth != 1.00 {
		t.Errorf("KMSKeyPerMonth = %v, want 1.00", KMSKeyPerMonth)
	}
}
